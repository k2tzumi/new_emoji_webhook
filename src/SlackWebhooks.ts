import { NetworkAccessError } from "./NetworkAccessError";

type URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;
type HTTPResponse = GoogleAppsScript.URL_Fetch.HTTPResponse;

class SlackWebhooks {

    public constructor(private incomingWebhookUrl: string) {
    }

    public invoke(message: string, thread_ts: string = null): boolean {
        let payload: {} = {
            text: message
        };
        if (thread_ts) {
            payload = { ...payload, thread_ts: thread_ts };
        }

        let response: HTTPResponse;

        try {
            response = UrlFetchApp.fetch(this.incomingWebhookUrl, this.requestOptions(payload));
        } catch (e) {
            console.warn(`DNS error, etc. ${e.message}`);
            throw new NetworkAccessError(500, e.message);
        }

        switch (response.getResponseCode()) {
            case 200:
                return response.getContentText() === 'ok';
            default:
                console.warn(`Incoming Webhook error. status: ${response.getResponseCode()}, content: ${response.getContentText()}`);
                throw new NetworkAccessError(response.getResponseCode(), response.getContentText());
        }
    }

    private requestOptions(payload: string | {}): URLFetchRequestOptions {
        const options: URLFetchRequestOptions = {
            method: 'post',
            headers: this.requestHeader(),
            muteHttpExceptions: true,
            payload: (payload instanceof String) ? payload : JSON.stringify(payload)
        };

        return options;
    }

    private requestHeader() {
        return {
            'content-type': 'application/json; charset=UTF-8'
        }
    }
}

export { SlackWebhooks }