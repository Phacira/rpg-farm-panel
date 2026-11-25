using System;
using Newtonsoft.Json;
public class CPHInline
{
    // RPG Ферма v6.57: триггер — Twitch → Chat → Chat Message (или Command Triggered для каждой команды).
    // Пересылает в игру !титул, !вклад, !пати, !купить, !экип, !снять, !парикмахер (с аргументами) вместе с user и displayName.
    static readonly string[] CMDS = { "!титул", "!вклад", "!пати", "!купить", "!экип", "!снять", "!парикмахер", "!погладить", "!котик", "!голос", "!гм", "!наградить", "!казна", "!бафф", "!гильдпоход", "!цель" }; // v9
    public bool Execute()
    {
        string text = "";
        if (!CPH.TryGetArg("rawInput", out text) || string.IsNullOrEmpty(text)) CPH.TryGetArg("message", out text);
        if (string.IsNullOrEmpty(text)) return true;
        string cmdName = ""; CPH.TryGetArg("command", out cmdName);
        if (!string.IsNullOrEmpty(cmdName) && !text.TrimStart().StartsWith("!")) text = cmdName + " " + text;
        string t = text.Trim(); string low = t.ToLowerInvariant();
        bool ok = false;
        foreach (var c in CMDS) if (low == c || low.StartsWith(c + " ")) { ok = true; break; }
        if (!ok) return true;
        string user = "";
        if (!CPH.TryGetArg("userName", out user) || string.IsNullOrEmpty(user)) CPH.TryGetArg("user", out user);
        string displayName = ""; if (!CPH.TryGetArg("user", out displayName) || string.IsNullOrEmpty(displayName)) displayName = user;
        string color = ""; CPH.TryGetArg("color", out color);
        CPH.WebsocketBroadcastJson(JsonConvert.SerializeObject(new { @event = "chat", user = (user ?? "").ToLowerInvariant(), displayName = displayName ?? user, text = t, color = color ?? "" }));
        return true;
    }
}
