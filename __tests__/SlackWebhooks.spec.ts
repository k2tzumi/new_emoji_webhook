import { SlackWebhooks } from "../src/SlackWebhooks";
import { NetworkAccessError } from "../src/NetworkAccessError";

console.warn = jest.fn();

const mockFetch = jest.fn();

UrlFetchApp.fetch = mockFetch;

const okResponse = {
    getResponseCode: jest.fn(function () {
        return 200;
    }),
    getContentText: jest.fn(function () {
        return 'ok';
    }),
};

const ngResponse = {
    getResponseCode: jest.fn(function () {
        return 500;
    }),
    getContentText: jest.fn(function () {
        return 'ng';
    }),
};

describe('SlackWebhooks', () => {
    it('ok', () => {
        const incomingWebhookUrl = 'dummy';
        const webhooks = new SlackWebhooks(incomingWebhookUrl);
        mockFetch.mockReturnValue(okResponse);
        const actual = webhooks.invoke('dummy');
        expect(mockFetch.mock.calls[0][0]).toBe(incomingWebhookUrl);
        expect(true).toStrictEqual(actual);
    });
    it('ng', () => {
        const incomingWebhookUrl = 'dummy';
        const webhooks = new SlackWebhooks(incomingWebhookUrl);
        mockFetch.mockReturnValue(ngResponse);
        expect(() => { webhooks.invoke('dummy') }).toThrowError(NetworkAccessError);
    });
});
