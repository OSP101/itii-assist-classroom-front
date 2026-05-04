import { apiService } from "./api.service";

export interface OAuthAccount {
  id: number;
  provider: 'google' | 'github' | 'apple';
  provider_email: string | null;
  provider_name: string | null;
  provider_avatar: string | null;
  linked_at: string;
}

export interface OAuthServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class OAuthService {
  /**
   * Get all linked OAuth accounts for the current user
   */
  async getLinkedAccounts(): Promise<OAuthServiceResult<OAuthAccount[]>> {
    try {
      const response = await apiService.get<OAuthAccount[]>("/oauth/linked");
      if (response.success) {
        return {
          success: true,
          data: response.data || [],
        };
      }
      return {
        success: false,
        error: response.error || "Failed to get linked accounts",
        data: [],
      };
    } catch (error) {
      console.error("Get linked accounts error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get linked accounts",
        data: [],
      };
    }
  }

  /**
   * Unlink an OAuth provider account
   */
  async unlinkAccount(provider: string): Promise<OAuthServiceResult> {
    try {
      const response = await apiService.delete<{ message: string }>(`/oauth/unlink/${provider}`);
      if (response.success) {
        return {
          success: true,
          message: response.message || "Account unlinked successfully",
        };
      }
      return {
        success: false,
        error: response.error || "Failed to unlink account",
      };
    } catch (error) {
      console.error("Unlink account error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to unlink account",
      };
    }
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider: string): string {
    const names: Record<string, string> = {
      google: "Google",
      github: "GitHub",
      apple: "Apple",
    };
    return names[provider] || provider;
  }

  /**
   * Get provider icon
   */
  getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      google: "logos:google-icon",
      github: "mingcute:github-fill",
      apple: "ic:baseline-apple",
    };
    return icons[provider] || "solar:link-bold";
  }

  /**
   * Initiate OAuth linking flow
   * Opens in a new tab; when done the tab sends postMessage back and closes itself.
   */
  initiateLink(provider: string): Window | null {
    // Get current access token for linking
    const accessToken = localStorage.getItem("accessToken");

    // Signal to the callback page (via shared localStorage) that this is a link action.
    // This is more reliable than backend cookies which can be dropped during cross-origin redirects.
    localStorage.setItem("pending_oauth_link_provider", provider);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
    const linkUrl = new URL(`${backendUrl}/auth/${provider}`);
    linkUrl.searchParams.set("action", "link");
    if (accessToken) {
      linkUrl.searchParams.set("link_token", accessToken);
    }

    // Open in a new tab — browsers allow this when triggered by a user click.
    // Do NOT pass a features string; any features string turns it into a popup window.
    // We intentionally avoid "noopener" so window.opener is accessible in the callback tab.
    const tab = window.open(linkUrl.toString(), "_blank");
    return tab;
  }
}

export const oauthService = new OAuthService();
