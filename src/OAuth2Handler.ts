import { OAuth2 } from "apps-script-oauth2/src/OAuth2";
import { Service } from "apps-script-oauth2/src/Service";

type Properties = GoogleAppsScript.Properties.Properties;
type HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;
type URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

interface OauthAccess {
    ok: boolean;
    error?: string;
    access_token: string;
    token_type: string;
    scope: string;
    bot_user_id: string;
    app_id: string;
    team: Team;
    enterprise: Enterprise;
    authed_user: AuthedUser;
    incoming_webhook: IncomingWebhook;
}

interface Team {
    name: string;
    id: string;
}

interface Enterprise {
    name: string;
    id: string;
}

interface AuthedUser {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
}

interface IncomingWebhook {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
}

interface TokenPayload {
    code: string;
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    grant_type: string;
}

class OAuth2Handler {

    static readonly SCOPE = 'incoming-webhook,emoji:read';

    private service: Service;

    private oAuthAccess: OauthAccess;

    public constructor(private clientId: string, private clientSecret: string, private propertyStore: Properties, private callbackFunctionName: string) {
        this.service = OAuth2.createService('slack')
            .setAuthorizationBaseUrl('https://slack.com/oauth/v2/authorize')
            .setTokenUrl('https://api.slack.com/methods/oauth.v2.access')
            .setTokenFormat('application/x-www-form-urlencoded')
            .setClientId(this.clientId)
            .setClientSecret(this.clientSecret)
            .setCallbackFunction(this.callbackFunctionName)
            .setPropertyStore(this.propertyStore)
            .setScope(OAuth2Handler.SCOPE)
            .setTokenPayloadHandler(this.tokenPayloadHandler);
    }

    /**
     * Handles the OAuth callback.
     */
    public authCallback(request): HtmlOutput {
        const authorized = this.service.handleCallback(request);
        if (authorized) {
            if (this.getOauthAccess(request.parameter.code)) {
                return this.createAuthenSuccessHtml();
            }
        }

        return HtmlService.createHtmlOutput('Denied. You can close this tab.');
    }

    private getOauthAccess(code: string): OauthAccess | null {
        const formData = {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: code,
        };

        const options: URLFetchRequestOptions = {
            contentType: "application/x-www-form-urlencoded",
            method: "post",
            payload: formData
        };

        this.oAuthAccess = JSON.parse(UrlFetchApp.fetch('https://slack.com/api/oauth.v2.access', options).getContentText());

        if (this.oAuthAccess.ok) {
            this.initializeProperty();

            return this.oAuthAccess;
        } else {
            console.warn(`error: ${this.oAuthAccess.error}`);
            return null;
        }
    }

    private initializeProperty() {
        const { access_token, bot_user_id, incoming_webhook } = this.oAuthAccess;
        // Save access token.
        this.propertyStore.setProperty('ACCESS_TOKEN', access_token);
        // Save bot user id.
        this.propertyStore.setProperty('BOT_USER_ID', bot_user_id);
        if (incoming_webhook) {
            // Save channel name.
            this.propertyStore.setProperty('CHANNEL_NAME', incoming_webhook.channel);
            // Save incoming webhooks.
            this.propertyStore.setProperty('INCOMING_WEBHOOKS_URL', incoming_webhook.url);
        }
    }

    private tokenPayloadHandler = function (tokenPayload: TokenPayload): TokenPayload {
        delete tokenPayload.client_id;

        return tokenPayload;
    }

    private createAuthenSuccessHtml(): HtmlOutput {
        const template = HtmlService.createTemplate(`
        Success!<br />
        <a href="<?= eventSubscriptionsUrl ?>" target="_blank">Setting EventSubscriptions</a><br />
        <a href="<?= slashCommnadsUrl ?>" target="_blank" >Setting Slash Commands</a><br />
        <a href="<?= interactiveMessagesUrl ?>" target="_blank" >Setting Interactivity & Shortcuts</a><br />
        `);
        template.eventSubscriptionsUrl = this.eventSubscriptionsUrl;
        template.slashCommnadsUrl = this.slashCommnadsUrl;
        template.interactiveMessagesUrl = this.interactiveMessagesUrl;

        return HtmlService.createHtmlOutput(template.evaluate());
    }

    /**
     * Reset the authorization state, so that it can be re-tested.
     */
    public clearService() {
        this.service.reset();
    }

    public get token(): string {
        const ACCESS_TOKEN: string = this.propertyStore.getProperty("ACCESS_TOKEN");

        if (ACCESS_TOKEN !== null) {
            return ACCESS_TOKEN;
        } else {
            const token: string = this.service.getAccessToken();

            if (token !== null) {
                // Save access token.
                this.propertyStore.setProperty('ACCESS_TOKEN', token);

                return token;
            }
        }
    }

    public verifyAccessToken(): boolean {
        return this.service.hasAccess();
    }

    public get authorizationUrl(): string {
        return this.service.getAuthorizationUrl();
    }

    public get redirectUri(): string {
        return this.service.getRedirectUri();
    }

    public get channelName(): string | null {
        return this.propertyStore.getProperty('CHANNEL_NAME');
    }

    public get botUserId(): string | null {
        return this.propertyStore.getProperty('BOT_USER_ID');
    }

    public get incomingWebhookUrl(): string | null {
        return this.propertyStore.getProperty('INCOMING_WEBHOOKS_URL');
    }

    private get eventSubscriptionsUrl(): string | null {
        if (this.oAuthAccess) {
            return `https://api.slack.com/apps/${this.oAuthAccess.app_id}/event-subscriptions?`
        }
        return null;
    }

    private get slashCommnadsUrl(): string | null {
        if (this.oAuthAccess) {
            return `https://api.slack.com/apps/${this.oAuthAccess.app_id}/slash-commands?`
        }
        return null;
    }

    private get interactiveMessagesUrl(): string | null {
        if (this.oAuthAccess) {
            return `https://api.slack.com/apps/${this.oAuthAccess.app_id}/interactive-messages?`
        }
        return null;
    }
}

export { OAuth2Handler }