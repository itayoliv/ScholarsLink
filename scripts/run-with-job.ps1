param(
  [Parameter(Mandatory = $true)]
  [string]$WorkDir,

  [Parameter(Mandatory = $true)]
  [string]$Command,

  [string]$Label = 'ScholarsLink'
)

$ErrorActionPreference = 'Stop'

$debugLog = Join-Path (Split-Path $PSScriptRoot -Parent) 'debug-9c0104.log'

function Write-AgentLog {
  param([string]$HypothesisId, [string]$Message, [hashtable]$Data = @{})
  #region agent log
  try {
    $payload = @{
      sessionId = '9c0104'
      runId = 'kill-on-close'
      hypothesisId = $HypothesisId
      location = 'scripts/run-with-job.ps1'
      message = $Message
      data = $Data
      timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress -Depth 5
    Add-Content -Path $debugLog -Value $payload -Encoding utf8
  } catch {
    # ignore logging failures
  }
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:7383/ingest/76763c12-b31d-43b3-8b80-eea38483679c' -Method Post -ContentType 'application/json' -Headers @{ 'X-Debug-Session-Id' = '9c0104' } -Body $payload | Out-Null
  } catch {
    # ignore ingest failures
  }
  #endregion
}

Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class KillOnCloseJob : IDisposable {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool CloseHandle(IntPtr hObject);

  [StructLayout(LayoutKind.Sequential)]
  struct IO_COUNTERS {
    public ulong ReadOperationCount;
    public ulong WriteOperationCount;
    public ulong OtherOperationCount;
    public ulong ReadTransferCount;
    public ulong WriteTransferCount;
    public ulong OtherTransferCount;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
  }

  const int JobObjectExtendedLimitInformation = 9;
  const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

  IntPtr handle;

  public KillOnCloseJob() {
    handle = CreateJobObject(IntPtr.Zero, null);
    if (handle == IntPtr.Zero) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }

    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
    IntPtr ptr = Marshal.AllocHGlobal(length);
    try {
      Marshal.StructureToPtr(info, ptr, false);
      if (!SetInformationJobObject(handle, JobObjectExtendedLimitInformation, ptr, (uint)length)) {
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      }
    } finally {
      Marshal.FreeHGlobal(ptr);
    }
  }

  public void AddProcess(Process process) {
    if (!AssignProcessToJobObject(handle, process.Handle)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }

  public void Dispose() {
    if (handle != IntPtr.Zero) {
      CloseHandle(handle);
      handle = IntPtr.Zero;
    }
  }
}
'@

if (-not (Test-Path -LiteralPath $WorkDir)) {
  throw "WorkDir does not exist: $WorkDir"
}

Set-Location -LiteralPath $WorkDir
Write-Host "[$Label] $Command"
Write-Host "[$Label] Working directory: $WorkDir"
Write-Host "[$Label] Closing this window will stop this service and free its ports."
Write-Host ""

$job = New-Object KillOnCloseJob
Write-AgentLog -HypothesisId 'H-JOB' -Message 'Created KillOnClose job' -Data @{ label = $Label; workDir = $WorkDir }

try {
  $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $Command) -WorkingDirectory $WorkDir -NoNewWindow -PassThru
  $job.AddProcess($process)
  Write-AgentLog -HypothesisId 'H-JOB' -Message 'Assigned process to job' -Data @{ label = $Label; pid = $process.Id }

  Wait-Process -Id $process.Id
  $exitCode = if ($null -ne $process.ExitCode) { $process.ExitCode } else { 0 }
  Write-AgentLog -HypothesisId 'H-JOB' -Message 'Process exited' -Data @{ label = $Label; pid = $process.Id; exitCode = $exitCode }
  exit $exitCode
} finally {
  $job.Dispose()
  Write-AgentLog -HypothesisId 'H-JOB' -Message 'Disposed job (kills remaining child processes)' -Data @{ label = $Label }
}
