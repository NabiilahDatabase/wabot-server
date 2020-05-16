const sulla = require('sulla');
const fs = require('fs-extra');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const db = low(new FileSync('../wabot-db/server.json'));

const wa = [];
const startServer = async (from) => {
    await fs.ensureDir('../wabot-db');
    await fs.ensureDir('../qr-codes');
    const serverExists = await fs.pathExists('./server');
    if (serverExists) {
        fs.remove("./server/Default/Service Worker/Database/MANIFEST-000001");
    }
    db.defaults({ admins: [], members: [], sessions: [] }).write();

    console.log('[STARTING SERVER]');
    sulla.create('server').then((server) => {
        if (from) { server.sendText(from, 'Server telah direstart ulang!'); }
        console.log('[SERVER] Server Started!');

        restartClients();

        server.onMessage((serverMessage) => {
            serverHandler(server, serverMessage);
        });

        // In case of being logged out of whatsapp web
        // Force it to keep the current session
        // State change
        server.onStateChange((state) => {
            console.log('[SERVER] Session:', color(state, 'red'));
            const conflits = [
                sulla.SocketState.CONFLICT,
                sulla.SocketState.UNPAIRED,
                sulla.SocketState.UNLAUNCHED,
            ];
            if (conflits.includes(state)) {
                server.useHere();
            }
        });
        // server.onAck(ack => {
        //   console.log('[ACK]', ack);
        // });
    });
}
const restartServer = (server, from) => {
    if (from) { server.sendText(from, 'Merestart ulang server...')}
    console.log('[SERVER] Restart Server...');
    const sessions = db.get('sessions').value();
    sessions.forEach(s => {
        wa[s.id].close();
    })
    server.close().catch((err) => console.log(err));
    startServer(from);
}
const restartClients = () => {
    const clientSessions = db.get('sessions').value();
    clientSessions.forEach(session => {
        fs.remove(`./${session.id}/Default/Service Worker/Database/MANIFEST-000001`).then(() => {
            console.log(`[SERVER] Restart Client ${session.id}`);
            sulla.create(session.id).then((client) => {
                console.log(`[CLIENT][${session.id}] Active!`);
                wa[session.id] = client;
                clientHandler(session.id);
            })
        });
    })
}
const serverHandler = async (server, serverMessage) => {
    const { type, body, from, t, sender, isGroupMsg, chat } = serverMessage;
    const { id, pushname } = sender;
    const { name } = chat;
    const commands = [
        '#getId', '#getAdmins', '#getSessions', '#addAdmin',
        '#createBot', '#restartServer'
    ];
    const cmds = commands.map(x => x + '\\b').join('|');
    let cmd = body.match(new RegExp(cmds, 'gi'));
    if (cmd) {
        console.log('[SERVER] [EXEC]', t, color(cmd[0]), 'from', color(pushname));
        const args = body.trim().split(' ');
        switch (cmd[0]) {
            case '#getId':
                server.sendText(from, from);
            break;
            case '#getAdmins':
                const admins = db.get('admins').value();
                console.log(admins);
            break;
            case '#getSessions':
                const sessions = Object.keys(wa);
                console.log(sessions);
                server.sendText(from, 'Sesi Aktif:\n\n' + sessions.join('\n'));
            break;
            case '#addAdmin':
                if (!isGroupMsg) {
                    db.get('admins').push({id: from, name: pushname}).write()
                    server.sendText(from, 'Anda sekarang admin!');
                }
            break;
            case '#createBot':
                if (!isGroupMsg && args.length===2) {
                    const id = args[1];
                    createClient(id, server, from);
                } else {
                    server.sendText(from, 'Contoh perintah: *#createBot hp-update*');
                }
            break;
            case '#restartServer':
                if (!isGroupMsg && args.length===2) {
                    if (args[1] === 'yes') restartServer(server, from);;
                } else {
                    server.sendText(from, '*#restartServer yes* untuk merestart server.\n(!) SEMUA CLIENT JUGA AKAN DIRESET (!)');
                }
            break;
        }
    } else {
        console.log('[SERVER]', color('[RECV]'), t, 'Message from', color(pushname));
    }
}
const createClient = (id, server, from) => {
    if (isSessionExist(id) !== 'restricted') {
        fs.remove(`./${id}/Default/Service Worker/Database/MANIFEST-000001`)
        .then(() => {
            console.log('[SERVER] Create WA Instance...');
            server.sendText(from, 'Sedang membuat bot baru, kami akan mengirimkan QR code untuk login Whatsapp Web');
            let attempt = 1;
            sulla.create(id, (base64Qr) => {
                if (attempt<4) {
                    console.log('[SERVER] Sending QR to Scan...', attempt);
                    sendQR(base64Qr, `../qr-codes/${id}.png`, server, from);
                    attempt++;
                } else {
                    restartServer(server, from);
                }
            }, {logQR: false}).then(
                (client) => {
                    wa[id] = client;
                    db.get('sessions').push({id, owner: from}).write();
                    server.sendText(from, `Bot *${id}* berhasil dibuat!`);
                    clientHandler(id);
                }
            );
        });
    } else {
        server.sendText(from, 'ID sesi tidak boleh digunakan!');
    }
}
const clientHandler = (id) => {
    wa[id].onMessage((clientMessage) => {
        console.log(`[CLIENT][${id}] Message recivied!`);
    });
    // In case of being logged out of whatsapp web
    // Force it to keep the current session
    // State change
    wa[id].onStateChange((state) => {
        console.log(`[CLIENT][${id}] Session:`, color(state, 'red'));
        const conflits = [
            sulla.SocketState.CONFLICT,
            sulla.SocketState.UNPAIRED,
            sulla.SocketState.UNLAUNCHED,
        ];
        if (conflits.includes(state)) {
            wa[id].useHere();
        }
    });
}
const isSessionExist = (id) => {
    const restrictedId = ['server', 'node_modules'];
    if (restrictedId.includes(id)) return 'restricted';

    const sessions = db.get('sessions').value();
    if (sessions.find(s => s.id === id)) { return 'exist';
    } else { return 'not-exist'; }
}
const sendQR = (base64Qr, path, server, sendTo) => {
    base64Qr = base64Qr.replace('data:image/png;base64,', '');
    const imageBuffer = Buffer.from(base64Qr, 'base64');
    // Creates 'marketing-qr.png' file
    fs.writeFileSync(path, imageBuffer);
    return server.sendImage(
        sendTo,
        path,
        `${sendTo}.jpg`,
        'Scan Dengan Whatsapp Web'
    );
}
const color = (text, color) => {
    switch (color) {
      case 'red': return '\x1b[31m' + text + '\x1b[0m'
      case 'yellow': return '\x1b[33m' + text + '\x1b[0m'
      default: return '\x1b[32m' + text + '\x1b[0m' // default is green
    }
}

module.exports = {
    startServer,
    restartServer,
    restartClients,
    serverHandler,
    createClient,
    clientHandler,
    isSessionExist,
    sendQR,
    color
}