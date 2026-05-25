import {
    Client,
    GatewayIntentBits
} from "discord.js";

import fs from "fs";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MANUAL_MESSAGE = process.env.MANUAL_MESSAGE;
// 保存したいユーザーID
const TARGET_USER_ID = process.env.TARGET_USER_ID;

const HISTORY = undefined;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function loadJson(path, defaultValue) {
    try {
        return JSON.parse(fs.readFileSync(path, "utf8"));
    } catch {
        return defaultValue;
    }
}

function saveJson(path, value) {
    fs.writeFileSync(
        path,
        JSON.stringify(value, null, 2)
    );
}

function getJSTDate() {
    return new Date(
        new Date().toLocaleString(
            "en-US",
            { timeZone: "Asia/Tokyo" }
        )
    );
}

function getTimeSlot(now) {
    const day = now.getDay();

    const h = now.getHours();
    const m = now.getMinutes();

    const minute = h * 60 + m;

    // 20:30~21:30
    if (minute >= 1230 && minute < 1290) {
        return "night";
    }

    // 土日限定
    const weekend = (day === 0 || day === 6);

    if (weekend) {
        // 10:00~11:00
        if (minute >= 600 && minute < 660) {
            return "weekend1";
        }

        // 13:00~14:00
        if (minute >= 780 && minute < 840) {
            return "weekend2";
        }

        // 17:00~18:00
        if (minute >= 1020 && minute < 1080) {
            return "weekend3";
        }
    } else {
        // 6:30~7:30
        if (minute >= 390 && minute < 450) {
            return "morning";
        }
    }

    return null;
}

function shouldSend(slot) {
    if (!slot) return false;

    const now = getJSTDate();

    const dateKey =
        now.toISOString().slice(0, 10);

    const sent = loadJson(
        "data/sent.json",
        {}
    );

    const key = `${dateKey}_${slot}`;

    // 既に送信済み
    if (sent[key]) {
        return false;
    }

    // ランダム判定
    const ok = Math.random() < 0.25;

    if (ok) {
        sent[key] = true;
        saveJson("data/sent.json", sent);
    }

    return ok;
}

async function saveUserHistory(guild) {

    let history =
        loadJson("data/history.json", []);

    if (!Array.isArray(history)) {
        history = [];
    }

    const textChannels =
        guild.channels.cache.filter(
            ch =>
                ch.isTextBased() &&
                ch.viewable
        );

    for (const channel of textChannels.values()) {

        console.log(
            `checking #${channel.name}`
        );

        try {

            const messages =
                await channel.messages.fetch({
                    limit: 10000
                });

            for (const msg of messages.values()) {

                if (
                    msg.author.id !== TARGET_USER_ID
                ) {
                    continue;
                }

                if (
                    history.some(
                        x => x.id === msg.id
                    )
                ) {
                    continue;
                }

                history.push(msg.content);

            }

        } catch (e) {

            console.log(
                `failed ${channel.name}`,
                e.message
            );

        }
    }

    history.sort(
        (a, b) =>
            new Date(a.createdAt)
            - new Date(b.createdAt)
    );

    saveJson(
        "data/history.json",
        history
    );

    HISTORY = history;
}

client.once("ready", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const channel =
        await client.channels.fetch(CHANNEL_ID);

    const guild = channel.guild;

    if (MANUAL_MESSAGE) {
        await channel.send(MANUAL_MESSAGE);

        client.destroy();
        return;
    }

    await saveUserHistory(guild);

    // ランダム送信
    const slot =
        getTimeSlot(getJSTDate());

    if (shouldSend(slot)) {
        if (!HISTORY) {
            HISTORY = loadJson("data/history.json", []);
        }

        await channel.send(
            HISTORY[Math.floor(Math.random() * HISTORY.length)]
        );

        console.log("message sent");
    }

    client.destroy();
});

client.login(TOKEN);
