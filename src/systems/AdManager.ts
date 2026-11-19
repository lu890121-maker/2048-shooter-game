export interface AdConfig {
  rewardedVideoAdUnitId: string;
  bannerAdUnitId: string;
  interstitialAdUnitId: string;
  interstitialCooldownMs: number;
}

interface WxMiniGameGlobal {
  wx?: {
    createRewardedVideoAd?: (opts: { adUnitId: string }) => WxRewardedVideoAd;
    createBannerAd?: (opts: { adUnitId: string; style: Record<string, number> }) => WxBannerAd;
    createInterstitialAd?: (opts: { adUnitId: string }) => WxInterstitialAd;
  };
}

interface WxRewardedVideoAd {
  load: () => Promise<void>;
  show: () => Promise<void>;
  onClose: (cb: (res?: { isEnded?: boolean }) => void) => void;
  onError: (cb: (err: unknown) => void) => void;
}

interface WxBannerAd {
  show: () => Promise<void>;
  hide: () => void;
  destroy: () => void;
}

interface WxInterstitialAd {
  load: () => Promise<void>;
  show: () => Promise<void>;
  onError: (cb: (err: unknown) => void) => void;
}

/**
 * WeChat Mini Game Traffic Master (流量主) adapter scaffold.
 * Safely no-ops in standard Web browsers so the same codebase runs on both Web and WeChat.
 */
export class AdManager {
  private rewardedAd: WxRewardedVideoAd | null = null;
  private bannerAd: WxBannerAd | null = null;
  private interstitialAd: WxInterstitialAd | null = null;
  private lastInterstitialAt = 0;

  constructor(private readonly config: AdConfig) {}

  private get wxApi() {
    return (globalThis as unknown as WxMiniGameGlobal).wx;
  }

  public init(): void {
    const wx = this.wxApi;
    if (!wx) return;

    if (wx.createRewardedVideoAd && this.config.rewardedVideoAdUnitId) {
      this.rewardedAd = wx.createRewardedVideoAd({ adUnitId: this.config.rewardedVideoAdUnitId });
      this.rewardedAd.onError(() => {});
    }

    if (wx.createInterstitialAd && this.config.interstitialAdUnitId) {
      this.interstitialAd = wx.createInterstitialAd({ adUnitId: this.config.interstitialAdUnitId });
      this.interstitialAd.onError(() => {});
    }
  }

  public showRewardedVideo(): Promise<boolean> {
    if (!this.rewardedAd) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const ad = this.rewardedAd!;
      const handleClose = (res?: { isEnded?: boolean }) => {
        resolve(Boolean(res && res.isEnded));
      };
      ad.onClose(handleClose);
      ad.show().catch(() => {
        ad.load()
          .then(() => ad.show())
          .catch(() => resolve(false));
      });
    });
  }

  public showInterstitialIfReady(): void {
    if (!this.interstitialAd) return;
    const now = Date.now();
    if (now - this.lastInterstitialAt < this.config.interstitialCooldownMs) {
      return;
    }
    this.lastInterstitialAt = now;
    this.interstitialAd.show().catch(() => {});
  }

  public showBanner(style: { left: number; top: number; width: number }): void {
    const wx = this.wxApi;
    if (!wx?.createBannerAd || !this.config.bannerAdUnitId) return;
    this.hideBanner();
    this.bannerAd = wx.createBannerAd({
      adUnitId: this.config.bannerAdUnitId,
      style,
    });
    this.bannerAd.show().catch(() => {});
  }

  public hideBanner(): void {
    if (this.bannerAd) {
      this.bannerAd.hide();
      this.bannerAd.destroy();
      this.bannerAd = null;
    }
  }
}
