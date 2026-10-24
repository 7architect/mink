$ErrorActionPreference = 'Stop'
# PowerShell and .NET ship with Windows. No native addon or build tools are needed.
# Assign a suspended process to the Job before allowing it to create descendants.
try {
  Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class MinkJob {
  [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS {
    public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
    public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMITS {
    public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMITS {
    public BASIC_LIMITS BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct STARTUPINFO {
    public uint cb;
    public string lpReserved, lpDesktop, lpTitle;
    public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public ushort wShowWindow, cbReserved2;
    public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION {
    public IntPtr hProcess, hThread;
    public uint dwProcessId, dwThreadId;
  }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref EXTENDED_LIMITS limits, uint size);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CreateProcess(string application, StringBuilder commandLine, IntPtr pa, IntPtr ta,
    bool inherit, uint flags, IntPtr environment, string directory, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int id);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll")] static extern bool GenerateConsoleCtrlEvent(uint control, uint group);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static Exception Error(string operation) {
    return new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), operation);
  }
  static readonly object gate = new object();
  static IntPtr job = IntPtr.Zero;
  static uint group;
  static bool cancelled;
  public static int Run() {
    PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
    var pipeName = Environment.GetEnvironmentVariable("MINK_WINDOWS_PIPE").Substring(9);
    using (var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut)) {
      pipe.Connect(10000);
      var writer = new StreamWriter(pipe, new UTF8Encoding(false));
      writer.AutoFlush = true;
      writer.WriteLine("control");
      var control = new Thread(() => {
        try {
          var reader = new StreamReader(pipe);
          while (true) {
            var message = reader.ReadLine();
            lock (gate) {
              cancelled = true;
              if (job != IntPtr.Zero) {
                if (message == "stop" && group != 0) GenerateConsoleCtrlEvent(1, group);
                else TerminateJobObject(job, 1);
              }
            }
            if (message != "stop") break;
          }
        } catch { lock (gate) { cancelled = true; if (job != IntPtr.Zero) TerminateJobObject(job, 1); } }
      });
      control.IsBackground = true;
      control.Start();
      try {
        lock (gate) {
          job = CreateJobObject(IntPtr.Zero, null);
          if (job == IntPtr.Zero) throw Error("CreateJobObject");
          var limits = new EXTENDED_LIMITS();
          limits.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
          if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) throw Error("SetInformationJobObject");
          var si = new STARTUPINFO();
          si.cb = (uint)Marshal.SizeOf(si);
          si.dwFlags = 0x100; // STARTF_USESTDHANDLES
          si.hStdInput = GetStdHandle(-10);
          si.hStdOutput = GetStdHandle(-11);
          si.hStdError = GetStdHandle(-12);
          if (!SetHandleInformation(si.hStdInput, 1, 1) || !SetHandleInformation(si.hStdOutput, 1, 1) || !SetHandleInformation(si.hStdError, 1, 1)) throw Error("SetHandleInformation");
          string node = Environment.GetEnvironmentVariable("MINK_WINDOWS_NODE");
          string entry = Environment.GetEnvironmentVariable("MINK_WINDOWS_ENTRY");
          var line = new StringBuilder("\"" + node + "\" \"" + entry + "\"");
          if (!CreateProcess(node, line, IntPtr.Zero, IntPtr.Zero, true, 0x204,
              IntPtr.Zero, null, ref si, out pi)) throw Error("CreateProcess");
          if (!AssignProcessToJobObject(job, pi.hProcess)) {
            var error = Error("AssignProcessToJobObject");
            TerminateProcess(pi.hProcess, 1);
            throw error;
          }
          group = pi.dwProcessId;
          if (cancelled) TerminateJobObject(job, 1);
          else if (ResumeThread(pi.hThread) == 0xffffffff) throw Error("ResumeThread");
        }
        WaitForSingleObject(pi.hProcess, 0xffffffff);
        uint code;
        if (!GetExitCodeProcess(pi.hProcess, out code)) throw Error("GetExitCodeProcess");
        return unchecked((int)code);
      } finally {
        lock (gate) { if (job != IntPtr.Zero) { CloseHandle(job); job = IntPtr.Zero; } }
        if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
        if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
      }
    }
  }
}
'@
  exit [MinkJob]::Run()
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
