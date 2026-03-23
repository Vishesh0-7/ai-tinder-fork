function makeProfile(overrides = {}) {
  return {
    id: "p_1",
    name: "Alex",
    age: 28,
    city: "Brooklyn",
    title: "Engineer",
    bio: "Hello",
    tags: ["Coffee", "Hiking"],
    images: ["https://img/1", "https://img/2"],
    currentPhotoIndex: 0,
    ...overrides,
  };
}

function makeSubscription(overrides = {}) {
  return {
    endpoint: "https://push.example/sub",
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key",
    },
    ...overrides,
  };
}

module.exports = {
  makeProfile,
  makeSubscription,
};
