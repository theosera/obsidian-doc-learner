import * as fs from "fs";
import * as path from "path";

/**
 * Cross-Vault path resolver.
 * Handles yearly rotating source vaults and fixed output vault.
 */
export interface IVaultResolver {
  resolveSourceVault(year?: number): string | null;
  getOutputVaultRoot(): string;
  resolveOutputPath(topic: string): string;
}

export class VaultResolver implements IVaultResolver {
  constructor(
    private sourceVaultPattern: string,
    private outputVaultRoot: string,
    private outputRoot: string
  ) {}

  /**
   * Resolve the source vault path for a given year.
   * Tries the specified year first, then falls back to current year and previous years.
   */
  resolveSourceVault(year?: number): string | null {
    if (year) {
      const resolved = this.sourceVaultPattern.replace("{year}", String(year));
      if (fs.existsSync(resolved)) return resolved;
    }

    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 2; y--) {
      const resolved = this.sourceVaultPattern.replace("{year}", String(y));
      if (fs.existsSync(resolved)) return resolved;
    }
    return null;
  }

  /**
   * Return the output vault root path (Permanent Note vault).
   */
  getOutputVaultRoot(): string {
    return this.outputVaultRoot;
  }

  /**
   * Resolve the full output path for a given topic folder.
   */
  resolveOutputPath(topic: string): string {
    return path.join(this.outputVaultRoot, this.outputRoot, topic);
  }

  /**
   * List all available source vault years.
   */
  listAvailableYears(): number[] {
    const years: number[] = [];
    const currentYear = new Date().getFullYear();

    for (let y = currentYear; y >= 2020; y--) {
      const resolved = this.sourceVaultPattern.replace("{year}", String(y));
      if (fs.existsSync(resolved)) years.push(y);
    }
    return years;
  }

  /**
   * Get the latest available source vault path.
   */
  getLatestSourceVault(): string | null {
    return this.resolveSourceVault();
  }
}
