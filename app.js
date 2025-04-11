const {
    Client,
    LocalAuth,
    MessageMedia,
    imageBuffer,
    Poll
} = require('whatsapp-web.js');
const sharp = require('sharp');
const QRCode = require('qrcode');
const ytdl = require('ytdl-core');
const path = require('path');
const schedule = require('node-schedule');
const fs = require('fs');
const axios = require('axios');
let isLoggedIn = false;
const readline = require('readline');
const terminalWidth = process.stdout.columns;
const line = '-'.repeat(terminalWidth);

// Inisialisasi client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
        ],
        logLevel: 'info',
        timeout: 600000
    }
});

let isAIEnabled = false;
let chatHistory = [];

client.on('authenticated', () => {
    isLoggedIn = true;
});

const searchImage = async (query) => {
    const apiKey = 'AIzaSyAGLSTbUFwTTkm5Om8jGBJ762mOOtSK03M';
    const cx = 'c673334c00dc941db';
    const url = `https://www.googleapis.com/customsearch/v1?q=${query}&cx=${cx}&searchType=image&key=${apiKey}`;

    try {
        const response = await axios.get(url);
        if (response.status == 200) {
            const images = response.data.items.map(item => item.link);
            return images;
        } else {
            throw new Error('Error dalam mendapatkan gambar');
        }
    } catch (error) {
        console.error('Error saat mencari gambar:', error);
        return [];
    }
};


client.on('ready', async () => {
    console.log('AI Whatsapp Siap digunakan');
    // const myNumber = client.info.wid._serialized;
    // const media = MessageMedia.fromFilePath('./whatsapp-qr.png');
    // const media2 = await MessageMedia.fromUrl('https://awsimages.detik.net.id/community/media/visual/2022/08/13/profil-prabowo-subianto-yang-nyatakan-siap-jadi-capres-2024-1_43.jpeg?w=1200');
    // try {
    //     await client.sendMessage(myNumber, media2, {
    //         caption: 'Ini adalah gambar yang diminta'
    //     });
    //     console.log('Pesan dengan media terkirim ke nomor sendiri.');
    // } catch (err) {
    //     console.error('Gagal mengirim media:', err.message);
    // }

    isLoggedIn = true;
});

client.on('disconnected', async (reason) => {
    console.log('Client was disconnected:', reason);
    await client.initialize();
});

client.on('auth_failure', async () => {
    isLoggedIn = false;
    console.log('Autentikasi Gagal');
});

const handleImage = async (message) => {

    const imageQuery = message.body.replace('#img', '').trim();
    console.log('Mencari gambar:', imageQuery);

    // Mengubah query menjadi format URL-friendly
    const imageConvert = imageQuery.replace(/ /g, '%20');

    // Mencari gambar menggunakan fungsi searchImage
    const images = await searchImage(imageConvert);

    if (images.length > 0) {
        // Memilih gambar secara acak dari hasil pencarian
        const randomIndex = Math.floor(Math.random() * images.length);
        const imageUrl = images[randomIndex];
        console.log('Menampilkan gambar:', imageUrl);

        try {
            // Mengunduh gambar
            const gambar = await MessageMedia.fromUrl(imageUrl);
            // Mengirim gambar dengan reply ke pesan asli
            await message.reply(gambar, message.to, {
                caption: 'Ini adalah gambar yang diminta',
            });

            console.log('Gambar berhasil dikirim sebagai reply!');
        } catch (error) {
            console.error('Gagal mengirim gambar:', error);
            message.reply('Terjadi kesalahan saat mengirim gambar.');
        }
    } else {
        // Jika tidak ditemukan gambar
        await message.reply('Maaf, tidak ditemukan gambar untuk pencarian tersebut.');
    }

};

const handleTeksAi = async (message) => {
    const senderNumber = message.from;
    console.log(senderNumber);
    let messageContent = message.body;

    messageContent = messageContent.replace('#ai', '').trim(); // Menghapus '#ai' dari pesan
    chatHistory.push({
        role: "user",
        content: messageContent
    });
    const payload = {
        model: "llama3-8b-8192",
        messages: [{
                role: "system",
                content: "Kamu adalah AI dengan Kepribadian INTJ: Serius, formal dan sangat analitis. Kamu memberikan jawaban berdasarkan logika, fakta, dan pemikiran strategis. Gunakan bahasa Indonesia dengan profesional, singkat dan tepat sasaran, namun tetap sopan."
            },
            {
                role: "user",
                content: messageContent
            }
        ]
    };

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            }
        });
        console.log('Di Jawab Oleh AI:', response.data.choices[0].message.content);
        chatHistory.push({
            role: "assistant",
            content: response.data.choices[0].message.content
        });
        message.reply(response.data.choices[0].message.content);

    } catch (err) {
        console.error('Error saat memanggil API:', err.message);
    }
};

// Fungsi untuk mengonversi gambar ke Base64
const convertImageToBase64 = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject('Error membaca file: ' + err.message);
            } else {
                const base64 = data.toString('base64'); // Mengonversi gambar menjadi base64
                // console.log(base64);
                resolve(base64);
            }
        });
    });
};

const saveImage = async (message) => {
    if (message.hasMedia && message.from != 'status@broadcast') {
        const media = await message.downloadMedia();

        // Atur nama file
        const fileName = `foto_${Date.now()}_${message.from}.jpeg`;
        const filePath = `./downloads/photos/${fileName}`;

        // Pastikan folder tujuan ada
        const dirPath = './downloads/photos';
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, {
                recursive: true
            });
        }

        // Simpan file
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, media.data, {
                encoding: 'base64'
            }, (err) => {
                if (err) {
                    console.error('Gagal menyimpan file:', err);
                    reject(err);
                } else {
                    console.log(`File berhasil disimpan di ${filePath}`);
                    resolve(filePath); // Kembalikan filePath setelah berhasil menyimpan
                }
            });
        });
    }
    return null; // Kembalikan null jika tidak ada media
};
const handleImageAi = async (message) => {
    const filePath = await saveImage(message); // Tunggu sampai gambar disimpan

    if (filePath) { // Pastikan filePath ada sebelum membuat payload
        const senderNumber = message.from;
        console.log(senderNumber);
        let messageContent = message.body;

        messageContent = messageContent.replace('#ai', '').trim();

        try {
            // Mengonversi gambar ke Base64
            const base64Image = await convertImageToBase64(filePath);

            // Membuat payload dengan struktur yang benar
            const payload = {
                model: "llama-3.2-11b-vision-preview",
                temperature: 0,
                messages: [
                    {
                        role: "user",
                        content: "Gunakan Bahasa Indonesia dalam Mengobrol"
                    },
                    {
                        role: "user",
                        content: [
                            {
                                "type": "text",
                                "text": messageContent
                            },
                            {
                                "type": "image_url", // Menggunakan objek untuk image_url
                                "image_url": {
                                    "url": `data:image/jpeg;base64,${base64Image}` // Gambar dalam format Base64
                                }
                            }
                        ]
                    },
                ]
            };

            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            });

            console.log('Di Jawab Oleh AI:', response.data.choices[0].message.content);
            chatHistory.push({
                role: "assistant",
                content: response.data.choices[0].message.content
            });
            message.reply(response.data.choices[0].message.content);

        } catch (err) {
            console.error('Error saat memanggil API:', err);
        }
    } else {
        console.log("Gambar tidak berhasil disimpan, tidak bisa mengirim gambar.");
    }
};

function saveMessageToText(message) {
    const senderNumber = message.from.includes('@c.us') ? message.from.split('@')[0] : null;
    const groupId = message.from.includes('@g.us') ? message.from : null;
    const fileName = senderNumber || groupId;

    if (!fileName) {
        console.log('Tidak dapat menentukan pengirim.');
        return;
    }

    // Tentukan lokasi file berdasarkan nomor pengirim
    const filePath = path.join(__dirname, '/pesan/', `${fileName}.txt`);

    // Format pesan yang akan disimpan
    const formattedMessage = `[${new Date().toISOString()}] ${message.body}\n`;

    // Simpan pesan ke file (append jika file sudah ada)
    fs.appendFile(filePath, formattedMessage, (err) => {
        if (err) {
            console.error(`Gagal menyimpan pesan untuk ${fileName}:`, err);
        } else {
            console.log(`Pesan tersimpan di ${filePath}`);
        }
    });
}

client.on('message_create', async message => {
    fromGrup = (message.from.includes('@g.us') || message.to.includes('@g.us'));
    fromMe = message.fromMe;
    isImage = message.type == 'image';
    fromStatus = message.from == 'status@broadcast';
    messageContent = message.body;
    awalanAI = messageContent.startsWith('#ai');
    // console.log(message.from);
    // console.log(message.type);
    // console.log('Menerima Pesan dari:', message.notifyName, 'Pesan:', message.body,);
    if ((fromGrup && !awalanAI) || (fromMe && !awalanAI) || fromStatus) {
        // console.log("Tidak bisa");
        return;
    } else if(awalanAI) {
        saveMessageToText(message);
        // console.log(message.body);
        if(isImage){
            await handleImageAi(message);
        }else{
            await handleTeksAi(message);
        }
        console.log("--------------------------------");
    }else{}
});

client.on('qr', qr => {
    console.log('QR Dibuat');
    QRCode.toFile(path.join('./whatsapp-qr.png'), qr, err => {
        if (err) throw err;
        console.log('QR code saved as whatsapp-qr.png');
    });
});

client.initialize();