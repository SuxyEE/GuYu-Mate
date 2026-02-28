import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// Types
export interface EnvironmentInfo {
  name: string;
  version: string | null;
  path: string | null;
  error: string | null;
  is_installed: boolean;
}

export interface EnvironmentStatus {
  node: EnvironmentInfo;
  npm: EnvironmentInfo;
  pnpm: EnvironmentInfo | null;
}

export interface CliPackageInfo {
  name: string;
  package: string;
  install_cmd: string;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

export interface CommandOutputEvent {
  task_id: string;
  output_type: "stdout" | "stderr" | "exit";
  content: string;
  exit_code: number | null;
}

export interface SystemInfo {
  os: string;
  arch: string;
  os_display: string;
  arch_display: string;
}
// API Functions
export const setupApi = {
  /**
   * Detect Node.js environment (node, npm, pnpm)
   */
  detectNodeEnvironment: async (): Promise<EnvironmentStatus> => {
    return invoke<EnvironmentStatus>("detect_node_environment");
  },

  /**
   * Get CLI installation info
   */
  getCliInstallInfo: async (cli: string): Promise<CliPackageInfo> => {
    return invoke<CliPackageInfo>("get_cli_install_info", { cli });
  },

  /**
   * Execute a command and return result (synchronous)
   */
  executeCommand: async (command: string): Promise<CommandResult> => {
    return invoke<CommandResult>("execute_command", { command });
  },

  /**
   * Execute a command with streaming output (asynchronous)
   * @param taskId Unique task identifier
   * @param command Command to execute
   * @returns Promise that resolves when command starts
   */
  executeCommandStream: async (
    taskId: string,
    command: string,
  ): Promise<void> => {
    return invoke<void>("execute_command_stream", { taskId, command });
  },

  /**
   * Cancel a running command
   * @param taskId Task identifier to cancel
   * @returns true if task was cancelled, false if not found
   */
  cancelCommand: async (taskId: string): Promise<boolean> => {
    return invoke<boolean>("cancel_command", { taskId });
  },

  /**
   * Listen for command output events
   * @param callback Function to call when output is received
   * @returns Unlisten function
   */
  onCommandOutput: async (
    callback: (event: CommandOutputEvent) => void,
  ): Promise<UnlistenFn> => {
    return listen<CommandOutputEvent>("command-output", (event) => {
      callback(event.payload);
    });
  },
  /**
   * Get system info (OS + architecture)
   */
  getSystemInfo: async (): Promise<SystemInfo> => {
    return invoke<SystemInfo>("get_system_info");
  },

  /**
   * Auto-install Node.js LTS (download + silent install)
   */
  installNodeAuto: async (taskId: string): Promise<void> => {
    return invoke<void>("install_node_auto", { taskId });
  },
};

export type { UnlistenFn };
