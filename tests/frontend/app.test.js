/** @jest-environment jsdom */

const path = require("path");
const { makeProfile } = require("../fixtures/factories");

function setupDom() {
  document.body.innerHTML = `
    <div class="app">
      <header class="app__header"></header>
      <section id="deck"></section>
      <button id="shuffleBtn">Shuffle</button>
      <button id="likeBtn">Like</button>
      <button id="nopeBtn">Nope</button>
      <button id="superLikeBtn">Super</button>
    </div>
  `;
}

function loadAppModule() {
  window.__AI_TINDER_DISABLE_AUTO_BOOT__ = true;
  return require(path.join(__dirname, "../../app.js")).__test__;
}

describe("app.js", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();

    setupDom();

    global.fetch = jest.fn();
    global.Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("default"),
    };

    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, writable: true });

    if (!global.atob) {
      global.atob = (str) => Buffer.from(str, "base64").toString("binary");
    }

    window.PushManager = function PushManager() {};
    navigator.serviceWorker = {
      register: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.__AI_TINDER_DISABLE_AUTO_BOOT__;
  });

  test("fetchProfiles returns API profiles and normalizes currentPhotoIndex", async () => {
    const api = loadAppModule();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "p_1",
          name: "Alex",
          age: 25,
          city: "Brooklyn",
          title: "Engineer",
          bio: "Hi",
          tags: ["Coffee"],
          images: ["img1", "img2"],
        },
      ],
    });

    const data = await api.fetchProfiles();

    expect(data).toHaveLength(1);
    expect(data[0].currentPhotoIndex).toBe(0);
  });

  test("fetchProfiles falls back to local generation on API failure", async () => {
    const api = loadAppModule();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    fetch.mockRejectedValueOnce(new Error("network"));

    const data = await api.fetchProfiles();

    expect(data).toHaveLength(12);
    expect(console.warn).toHaveBeenCalled();
    console.warn.mockRestore();
  });

  test("renderDeck shows empty state when no profiles", () => {
    const api = loadAppModule();
    api.setProfilesForTest([]);

    api.renderDeck();

    expect(document.querySelector(".deck__empty")).not.toBeNull();
  });

  test("renderDeck creates cards and indicators for profile images", () => {
    const api = loadAppModule();
    api.setProfilesForTest([
      makeProfile({ id: "p_1", images: ["img1", "img2", "img3"], tags: ["Coffee", "Movies"] }),
      makeProfile({ id: "p_2", images: ["img-only"] }),
    ]);

    api.renderDeck();

    expect(document.querySelectorAll(".card")).toHaveLength(2);
    expect(document.querySelectorAll(".card__stamp")).toHaveLength(6);
    expect(document.querySelectorAll(".photo-dot")).toHaveLength(3);
  });

  test("like button dismisses card and posts action side effect", () => {
    const api = loadAppModule();
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    api.setProfilesForTest([makeProfile({ id: "p_like" })]);
    api.renderDeck();

    document.getElementById("likeBtn").click();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/actions$/),
      expect.objectContaining({ method: "POST" })
    );

    jest.advanceTimersByTime(350);
    expect(document.querySelectorAll(".card")).toHaveLength(0);
  });

  test("double tap cycles to next photo", () => {
    const api = loadAppModule();

    api.setProfilesForTest([
      makeProfile({
        id: "p_photos",
        name: "Sam",
        images: ["https://img/1", "https://img/2"],
      }),
    ]);
    api.renderDeck();

    const card = document.querySelector(".card");

    card.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true }));

    jest.advanceTimersByTime(100);

    card.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 10, clientY: 10, bubbles: true }));

    jest.advanceTimersByTime(200);

    const img = document.querySelector(".card__media");
    expect(img.src).toContain("https://img/2");
  });

  test("urlBase64ToUint8Array decodes URL-safe base64", () => {
    const api = loadAppModule();
    const result = api.urlBase64ToUint8Array("SGVsbG8");

    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
  });

  test("renderPushBanner supports unsupported, denied, and dismissed states", () => {
    const api = loadAppModule();
    const state = api.getState();

    state.pushState.supported = false;
    api.renderPushBanner();
    expect(document.getElementById("pushBanner").textContent).toMatch(/not supported/);

    state.pushState.supported = true;
    state.pushState.permission = "denied";
    state.pushState.subscription = null;
    api.renderPushBanner();
    expect(document.getElementById("pushBanner").textContent).toMatch(/Notifications blocked/);

    state.pushState.permission = "default";
    api.renderPushBanner();
    const dismiss = document.getElementById("dismissPushBtn");
    dismiss.click();
    expect(document.getElementById("pushBanner")).toBeNull();
  });

  test("requestPushPermission subscribes when granted", async () => {
    const api = loadAppModule();
    const state = api.getState();

    const subscription = { endpoint: "https://push/sub", keys: { p256dh: "k", auth: "a" } };
    const registration = {
      pushManager: {
        subscribe: jest.fn().mockResolvedValue(subscription),
      },
    };

    state.pushState.supported = true;
    state.pushState.registration = registration;
    Notification.requestPermission.mockResolvedValueOnce("granted");

    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ publicKey: "BEl6ZWQ" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await api.requestPushPermission();

    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringMatching(/vapid-public-key$/));
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/api\/push\/subscribe$/),
      expect.objectContaining({ method: "POST" })
    );
  });
});
