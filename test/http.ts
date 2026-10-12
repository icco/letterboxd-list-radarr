const assert = require("node:assert/strict");
const { test } = require("node:test");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { createClient } = require("redis");

test("production HTTP streams cached lists, limits results, filters TV and handles empty lists", async () => {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (error: Error) => console.error(error));
    await client.connect();
    const keys = ["/alice/list/migration/", "/alice/list/empty/", "/film/ada/", "/film/bob/", "/film/tv/"];
    let child;
    try {
        await client.set(keys[0], JSON.stringify([
            { slug: keys[2], title: "Ada Lovelace" },
            { slug: keys[3], title: "Bob" },
            { slug: keys[4], title: "TV" },
        ]));
        await client.set(keys[1], "[]");
        await client.set(keys[2], JSON.stringify({ slug: keys[2], name: "Ada Lovelace", published: "2020", imdb: "tt1234567", tmdb: "123" }));
        await client.set(keys[3], JSON.stringify({ slug: keys[3], name: "Bob", published: "2021", imdb: "tt7654321", tmdb: "456" }));
        await client.set(keys[4], JSON.stringify({ slug: keys[4], name: "TV", published: "2021", imdb: "tt7654322" }));
        const base = process.env.BASE_URL || "http://127.0.0.1:5100";
        if (!process.env.BASE_URL) {
            child = spawn(process.execPath, ["dist/index.js"], { env: { ...process.env, PORT: "5100" }, stdio: ["ignore", "pipe", "inherit"] });
            await Promise.race([
                new Promise(resolve => child.stdout.on("data", data => {
                    if (data.toString().includes("Redis ready")) resolve(undefined);
                })),
                once(child, "exit").then(([code]) => { throw new Error(`App exited: ${code}`); }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("App not ready")), 10000).unref()),
            ]);
        }
        const root = await fetch(base);
        assert.equal(root.status, 200);
        assert.equal(await root.text(), "Use letterboxd.com path as path here.");
        assert.equal((await fetch(`${base}/favicon.ico`)).status, 404);
        const list = await fetch(`${base}${keys[0]}`);
        assert.equal(list.status, 200);
        const movies = await list.json();
        assert.equal(movies.length, 2);
        assert.deepEqual(movies.find(movie => movie.id === 123), { id: 123, imdb_id: "tt1234567", title: "Ada Lovelace", release_year: "2020", clean_title: keys[2], adult: false });
        assert.equal((await (await fetch(`${base}${keys[0]}?limit=1`)).json()).length, 1);
        assert.equal((await fetch(`${base}${keys[1]}`)).status, 404);
        assert.deepEqual(await (await fetch(`${base}${keys[1]}?errorOnEmpty=false`)).json(), []);
    } finally {
        if (child && child.exitCode === null) {
            child.kill();
            await once(child, "exit");
        }
        await client.del(keys);
        await client.close();
    }
});
