import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { build } from "esbuild";
import {
  profileAvatars,
  profileCovers,
  profileAvatar,
  profileCover,
  profileInitials,
  validAppearance,
} from "../src/lib/profileAppearance.ts";

test("five distinct portraits and five covers are local, bounded assets", async () => {
  assert.equal(profileAvatars.length, 5);
  assert.equal(profileCovers.length, 5);
  for (const group of [profileAvatars, profileCovers]) {
    assert.equal(new Set(group.map((item) => item.id)).size, 5);
    for (const item of group) {
      assert.match(item.src, /^\/profile-art\/(avatar|cover)-[a-z]+\.jpg$/);
      const info = await stat("public" + item.src);
      assert.ok(info.size > 1000 && info.size < 200_000);
    }
  }
});

test("avatar selection, initials and original account photo remain separate", () => {
  const account = {
    avatar_url: "https://avatars.example.test/photo.png",
    archon_avatar_preset: "rover",
  };
  assert.equal(profileAvatar(account), "/profile-art/avatar-rover.jpg");
  assert.equal(profileAvatar({ ...account, archon_avatar_preset: "initials" }), null);
  assert.equal(profileAvatar({ ...account, archon_avatar_preset: "original" }), account.avatar_url);
  assert.equal(profileAvatar({ avatar_url: "javascript:alert(1)" }), null);
  assert.equal(profileAvatar({ avatar_url: "data:image/svg+xml,untrusted" }), null);
  assert.equal(profileAvatar({ archon_avatar_preset: "../../private" }), null);
  assert.equal(profileInitials({ full_name: "Jignesh Sonewane" }), "JS");
  assert.equal(profileInitials({ full_name: "  " }, "user@example.test"), "US");
});

test("legacy covers survive; invalid preset IDs never become asset paths", () => {
  assert.equal(profileCover({}, 3), "/covers/cover-3.jpg");
  assert.equal(profileCover({}, 99), "/covers/cover-1.jpg");
  assert.equal(
    profileCover({ archon_cover_preset: "workshop" }, 3),
    "/profile-art/cover-workshop.jpg",
  );
  assert.equal(profileCover({ archon_cover_preset: "../../private" }, 3), "/covers/cover-3.jpg");
  assert.ok(validAppearance("avatar", "initials"));
  assert.ok(!validAppearance("cover", "initials"));
  assert.ok(!validAppearance("permissions", "foundry"));
});

const bundled = await build({
  stdin: {
    contents:
      'export {saveProfileAppearance} from "./src/lib/api/profileAppearance"; export {setAuthOwner} from "./src/lib/authState";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "profile-sdk-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            "export const supabase={auth:{updateUser:(data)=>globalThis.profileUpdate(data)}};",
        }));
      },
    },
  ],
});
const api = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

test("saved appearance writes one cosmetic field and requires confirmed persistence", async () => {
  api.setAuthOwner("actor");
  const original = globalThis.profileUpdate;
  try {
    globalThis.profileUpdate = async (payload) => {
      assert.deepEqual(payload, { data: { archon_avatar_preset: "scout" } });
      return { data: { user: { id: "actor", user_metadata: payload.data } }, error: null };
    };
    await api.saveProfileAppearance("actor", "avatar", "scout");
    globalThis.profileUpdate = async () => ({
      data: { user: { id: "actor", user_metadata: {} } },
      error: null,
    });
    await assert.rejects(
      api.saveProfileAppearance("actor", "cover", "paper"),
      /could not be saved/,
    );
    globalThis.profileUpdate = async () => ({
      data: { user: null },
      error: new Error("synthetic provider failure"),
    });
    await assert.rejects(
      api.saveProfileAppearance("actor", "avatar", "scout"),
      /could not be saved/,
    );
  } finally {
    globalThis.profileUpdate = original;
    api.setAuthOwner(null);
  }
});

test("account changes reject stale saves and invalid options do not send requests", async () => {
  const original = globalThis.profileUpdate;
  let requests = 0;
  try {
    api.setAuthOwner("actor");
    globalThis.profileUpdate = async () => {
      requests++;
      api.setAuthOwner("other");
      return {
        data: { user: { id: "actor", user_metadata: { archon_cover_preset: "foundry" } } },
        error: null,
      };
    };
    await assert.rejects(api.saveProfileAppearance("actor", "cover", "foundry"), /account changed/);
    await assert.rejects(api.saveProfileAppearance("actor", "avatar", "scout"), /account changed/);
    await assert.rejects(
      api.saveProfileAppearance("other", "avatar", "unknown"),
      /available profile artwork/,
    );
    assert.equal(requests, 1);
  } finally {
    globalThis.profileUpdate = original;
    api.setAuthOwner(null);
  }
});

test("workspace styling does not advertise every workspace as active", async () => {
  const source = await readFile("src/components/workspace-switcher.tsx", "utf8");
  assert.doesNotMatch(source, /workspaceList\.length\} Active/);
  assert.doesNotMatch(source, /group-hover:scale-105/);
  assert.match(source, /aria-selected=\{isActive\}/);
});
