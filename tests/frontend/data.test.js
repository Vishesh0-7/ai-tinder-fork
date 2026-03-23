describe("data.js profile generator", () => {
  function loadData() {
    jest.resetModules();
    return require("../../data.js");
  }

  test("exports TAGS and generateProfiles", () => {
    const mod = loadData();
    expect(Array.isArray(mod.TAGS)).toBe(true);
    expect(typeof mod.generateProfiles).toBe("function");
  });

  test("generates default number of profiles", () => {
    const { generateProfiles } = loadData();
    const profiles = generateProfiles();

    expect(profiles).toHaveLength(12);
  });

  test("respects explicit count and supports zero", () => {
    const { generateProfiles } = loadData();

    expect(generateProfiles(3)).toHaveLength(3);
    expect(generateProfiles(0)).toHaveLength(0);
  });

  test("builds valid profile shapes and boundary-safe ranges", () => {
    const { generateProfiles } = loadData();
    const profiles = generateProfiles(25);

    for (const p of profiles) {
      expect(p.id).toMatch(/^p_/);
      expect(typeof p.name).toBe("string");
      expect(p.age).toBeGreaterThanOrEqual(18);
      expect(p.age).toBeLessThanOrEqual(39);
      expect(typeof p.city).toBe("string");
      expect(typeof p.title).toBe("string");
      expect(typeof p.bio).toBe("string");
      expect(Array.isArray(p.tags)).toBe(true);
      expect(p.tags.length).toBeGreaterThanOrEqual(1);
      expect(p.tags.length).toBeLessThanOrEqual(4);
      expect(new Set(p.tags).size).toBe(p.tags.length);
      expect(typeof p.img).toBe("string");
      expect(p.img).toContain("https://images.unsplash.com/photo-");
    }
  });
});
