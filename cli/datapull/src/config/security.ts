import { chmod, mkdir, stat } from "node:fs/promises";
import { execa } from "execa";
import { DataPullError } from "../core/errors.js";

const FORBIDDEN_WINDOWS_PRINCIPALS = [
  "Everyone",
  "Authenticated Users",
  "BUILTIN\\Users",
  "S-1-1-0",
  "S-1-5-11",
  "S-1-5-32-545",
] as const;

export class CredentialSecurity {
  readonly platform: NodeJS.Platform;

  constructor(platform = process.platform) {
    this.platform = platform;
  }

  async secureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o700 });
    if (this.platform === "win32") await this.secureWindows(path, true);
    else {
      await chmod(path, 0o700);
      await this.verifyUnix(path, 0o700);
    }
  }

  async secureFile(path: string): Promise<void> {
    if (this.platform === "win32") await this.secureWindows(path, false);
    else {
      await chmod(path, 0o600);
      await this.verifyUnix(path, 0o600);
    }
  }

  async verifyFile(path: string): Promise<void> {
    if (this.platform === "win32") await this.verifyWindows(path);
    else await this.verifyUnix(path, 0o600);
  }

  private async verifyUnix(path: string, maximumMode: number): Promise<void> {
    const metadata = await stat(path);
    const mode = metadata.mode & 0o777;
    if ((mode & ~maximumMode) !== 0) this.insecure(path, mode.toString(8));
  }

  private async secureWindows(path: string, directory: boolean): Promise<void> {
    try {
      const sidResult = await execa(
        "whoami",
        ["/user", "/fo", "csv", "/nh"],
        { windowsHide: true },
      );
      const sid = sidResult.stdout.match(/S-1-[0-9-]+/u)?.[0];
      if (sid === undefined) this.insecure(path, "无法读取当前用户 SID");
      const inheritance = directory ? "(OI)(CI)F" : "F";
      await execa(
        "icacls",
        [
          path,
          "/inheritance:r",
          "/grant:r",
          `*${sid}:${inheritance}`,
          "*S-1-5-18:F",
          "*S-1-5-32-544:F",
        ],
        { windowsHide: true },
      );
      await this.verifyWindows(path);
    } catch (error) {
      if (error instanceof DataPullError) throw error;
      this.insecure(path, error instanceof Error ? error.message : String(error));
    }
  }

  private async verifyWindows(path: string): Promise<void> {
    try {
      const result = await execa("icacls", [path], { windowsHide: true });
      const forbidden = FORBIDDEN_WINDOWS_PRINCIPALS.find((principal) =>
        result.stdout.toLocaleLowerCase("en-US").includes(
          principal.toLocaleLowerCase("en-US"),
        ),
      );
      if (forbidden !== undefined) this.insecure(path, `存在宽泛读取主体 ${forbidden}`);
    } catch (error) {
      if (error instanceof DataPullError) throw error;
      this.insecure(path, error instanceof Error ? error.message : String(error));
    }
  }

  private insecure(path: string, reason: string): never {
    throw new DataPullError(
      "CREDENTIALS_FILE_INSECURE",
      `无法确认凭证文件权限安全：${path}`,
      3,
      { reason },
    );
  }
}
