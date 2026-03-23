describe("service worker", () => {
  let handlers;

  beforeEach(() => {
    jest.resetModules();
    handlers = {};

    global.self = {
      addEventListener: jest.fn((type, fn) => {
        handlers[type] = fn;
      }),
      skipWaiting: jest.fn(),
      location: { origin: "https://app.example" },
      registration: {
        showNotification: jest.fn(() => Promise.resolve()),
      },
      clients: {
        claim: jest.fn(() => Promise.resolve()),
        matchAll: jest.fn(() => Promise.resolve([])),
        openWindow: jest.fn(() => Promise.resolve()),
      },
    };

    require("../../sw.js");
  });

  test("handles install and activate lifecycle", async () => {
    handlers.install({});
    expect(self.skipWaiting).toHaveBeenCalledTimes(1);

    const waitUntil = jest.fn((p) => p);
    handlers.activate({ waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  test("shows push notification with parsed json payload", async () => {
    const waitUntil = jest.fn((p) => p);
    const event = {
      data: {
        json: () => ({ title: "Title", body: "Body", url: "/x" }),
      },
      waitUntil,
    };

    handlers.push(event);

    expect(waitUntil).toHaveBeenCalled();
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "Title",
      expect.objectContaining({ body: "Body", data: { url: "/x" } })
    );
  });

  test("falls back to text payload when json parsing fails", () => {
    const waitUntil = jest.fn((p) => p);
    const event = {
      data: {
        json: () => {
          throw new Error("bad json");
        },
        text: () => "Text fallback",
      },
      waitUntil,
    };

    handlers.push(event);

    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "Tinder Clone",
      expect.objectContaining({ body: "Text fallback" })
    );
  });

  test("focuses existing app window on notification click", async () => {
    const focus = jest.fn(() => Promise.resolve());
    self.clients.matchAll.mockResolvedValueOnce([
      { url: "https://app.example/page", focus },
    ]);

    const waitUntil = jest.fn((p) => p);
    const event = {
      notification: {
        close: jest.fn(),
        data: { url: "/target" },
      },
      waitUntil,
    };

    handlers.notificationclick(event);
    await waitUntil.mock.calls[0][0];

    expect(event.notification.close).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  test("opens a new window when no existing client matches", async () => {
    self.clients.matchAll.mockResolvedValueOnce([{ url: "https://other.example" }]);
    self.clients.openWindow.mockResolvedValueOnce(undefined);

    const waitUntil = jest.fn((p) => p);
    const event = {
      notification: {
        close: jest.fn(),
        data: { url: "/new" },
      },
      waitUntil,
    };

    handlers.notificationclick(event);
    await waitUntil.mock.calls[0][0];

    expect(self.clients.openWindow).toHaveBeenCalledWith("/new");
  });
});
