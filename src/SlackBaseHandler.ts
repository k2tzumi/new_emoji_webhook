import { Slack } from "./slack/types/callback-events.d";

type Cache = GoogleAppsScript.Cache.Cache;
type TextOutput = GoogleAppsScript.Content.TextOutput;
type CallbackEvent = Slack.CallbackEvent.EventBase;
type CallbackEventFunction = (event: CallbackEvent) => {} | null;

abstract class SlackBaseHandler {
  protected cache: Cache;
  protected listners: Map<string, CallbackEventFunction>;

  public constructor(private verificationToken: string) {
    this.cache = CacheService.getScriptCache();
    this.listners = new Map<string, CallbackEventFunction>();
  }

  public abstract handle(e): { performed: boolean; output: TextOutput | null };

  public addListener(type: string, handler: CallbackEventFunction) {
    this.listners.set(type, handler);
  }

  protected getListener(type: string): CallbackEventFunction | null {
    return this.listners.get(type);
  }

  protected validateVerificationToken(token: string | null): void {
    if (token !== this.verificationToken) {
      throw new Error(`Invalid verification token. token: ${token}`);
    }
  }

  protected isHandleProceeded(id: string): boolean {
    const key: string = `${this.constructor.name}#${id}`;

    if (this.cache.get(key)) {
      return true;
    } else {
      this.cache.put(key, "proceeded", 60);
      return false;
    }
  }

  protected convertJSONOutput(response: {} | null): TextOutput {
    if (response) {
      return ContentService.createTextOutput(
        JSON.stringify(response)
      ).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput();
    }
  }
}

export { SlackBaseHandler, CallbackEventFunction };
