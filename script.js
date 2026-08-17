const messageInput = document.getElementById("message");
const sendButton = document.getElementById("send");
const chat = document.getElementById("chat");
const languageSelect = document.getElementById("language");

const newChatButton = document.getElementById("newChat");
const chatHistory = document.getElementById("chatHistory");
const deleteAllChats = document.getElementById("deleteAllChats");

const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");

const themeButton = document.getElementById("themeButton");

const memoryButton = document.getElementById("memoryButton");
const memoryModal = document.getElementById("memoryModal");
const memoryContent = document.getElementById("memoryContent");
const closeMemory = document.getElementById("closeMemory");
const clearMemory = document.getElementById("clearMemory");


// ======================================================
// CLOUDFLARE WORKER
// ======================================================

const AI_URL =
    "https://seek-ai-server.samyaruserdr2.workers.dev";


// ======================================================
// FIREBASE
// ======================================================

let firebaseAuth = null;
let firebaseDB = null;
let firebaseTools = null;
let googleProvider = null;

let currentUser = null;


// ======================================================
// CHAT STATE
// ======================================================

let conversation = [];
let currentChatId = null;
let savedChats = [];

let voiceEnabled =
    localStorage.getItem("seekVoiceEnabled") !== "false";

let currentTheme =
    localStorage.getItem("seekTheme") || "dark";

let recognition = null;
let isListening = false;


// ======================================================
// LOCAL STORAGE
// ======================================================

function getLocalChats() {
    try {
        const chats = JSON.parse(
            localStorage.getItem("seekChats") || "[]"
        );

        return Array.isArray(chats) ? chats : [];
    } catch {
        return [];
    }
}

function saveLocalChats(chats) {
    localStorage.setItem(
        "seekChats",
        JSON.stringify(chats)
    );
}


// ======================================================
// FIREBASE INITIALIZATION
// ======================================================

function initializeFirebaseConnection() {

    if (
        window.firebaseAuth &&
        window.firebaseDB &&
        window.firebaseTools &&
        window.googleProvider
    ) {

        firebaseAuth = window.firebaseAuth;
        firebaseDB = window.firebaseDB;
        firebaseTools = window.firebaseTools;
        googleProvider = window.googleProvider;

        console.log("Firebase connected.");

        setupFirebaseAuth();

    } else {

        console.warn(
            "Firebase is not ready. Using local chat storage."
        );

        savedChats = getLocalChats();
        renderChatHistory();
    }
}


// ======================================================
// GOOGLE AUTH
// ======================================================

function setupFirebaseAuth() {

    const loginButton =
        document.getElementById("googleLoginButton");

    const accountInfo =
        document.getElementById("accountInfo");


    if (!loginButton) {

        console.error(
            "Google login button not found."
        );

        return;
    }


    loginButton.onclick =
        signInWithGoogle;


    firebaseTools.onAuthStateChanged(
        firebaseAuth,
        async user => {

            currentUser =
                user || null;


            if (currentUser) {

                loginButton.textContent =
                    "Sign Out";

                loginButton.onclick =
                    signOutGoogle;


                if (accountInfo) {

                    accountInfo.style.display =
                        "block";

                    accountInfo.textContent =
                        currentUser.email;
                }


                await loadCloudChats();


            } else {

                loginButton.textContent =
                    "Continue with Google";

                loginButton.onclick =
                    signInWithGoogle;


                if (accountInfo) {

                    accountInfo.style.display =
                        "none";

                    accountInfo.textContent =
                        "";
                }


                savedChats =
                    getLocalChats();

                renderChatHistory();
            }
        }
    );
}


async function signInWithGoogle() {

    if (
        !firebaseAuth ||
        !firebaseTools ||
        !googleProvider
    ) {

        alert(
            "Firebase is not ready yet."
        );

        return;
    }


    try {

        await firebaseTools.signInWithPopup(
            firebaseAuth,
            googleProvider
        );

    } catch (error) {

        console.error(
            "Google sign-in error:",
            error
        );

        alert(
            "Google sign-in failed:\n\n" +
            error.message
        );
    }
}


async function signOutGoogle() {

    if (
        !firebaseAuth ||
        !firebaseTools
    ) {
        return;
    }


    try {

        await firebaseTools.signOut(
            firebaseAuth
        );

        currentUser = null;

        conversation = [];
        currentChatId = null;

        showWelcome();

        savedChats =
            getLocalChats();

        renderChatHistory();

    } catch (error) {

        console.error(
            "Sign-out error:",
            error
        );
    }
}


// ======================================================
// CLOUD FIRESTORE
// ======================================================

function getCloudChatsCollection() {

    if (
        !firebaseDB ||
        !firebaseTools ||
        !currentUser
    ) {
        return null;
    }


    return firebaseTools.collection(
        firebaseDB,
        "users",
        currentUser.uid,
        "chats"
    );
}


async function loadCloudChats() {

    if (!currentUser) {
        return;
    }


    try {

        const collectionRef =
            getCloudChatsCollection();


        if (!collectionRef) {
            return;
        }


        const snapshot =
            await firebaseTools.getDocs(
                collectionRef
            );


        savedChats = [];


        snapshot.forEach(
            item => {

                savedChats.push({
                    id:
                        item.id,

                    ...item.data()
                });
            }
        );


        savedChats.sort(
            (a, b) => {

                return (
                    (b.updatedAt || 0) -
                    (a.updatedAt || 0)
                );
            }
        );


        renderChatHistory();

    } catch (error) {

        console.error(
            "Firestore load error:",
            error
        );

        savedChats =
            getLocalChats();

        renderChatHistory();
    }
}


async function saveChatToCloud(chatData) {

    if (
        !currentUser ||
        !firebaseDB ||
        !firebaseTools
    ) {
        return;
    }


    try {

        const chatRef =
            firebaseTools.doc(
                firebaseDB,
                "users",
                currentUser.uid,
                "chats",
                String(chatData.id)
            );


        await firebaseTools.setDoc(
            chatRef,
            {
                title:
                    chatData.title,

                messages:
                    chatData.messages,

                language:
                    chatData.language,

                createdAt:
                    chatData.createdAt ||
                    Date.now(),

                updatedAt:
                    Date.now()
            }
        );

    } catch (error) {

        console.error(
            "Firestore save error:",
            error
        );
    }
}


async function deleteCloudChat(id) {

    if (
        !currentUser ||
        !firebaseDB ||
        !firebaseTools
    ) {
        return;
    }


    try {

        const chatRef =
            firebaseTools.doc(
                firebaseDB,
                "users",
                currentUser.uid,
                "chats",
                String(id)
            );


        await firebaseTools.deleteDoc(
            chatRef
        );

    } catch (error) {

        console.error(
            "Firestore delete error:",
            error
        );
    }
}


async function deleteAllCloudChats() {

    if (!currentUser) {
        return;
    }


    const chats =
        [...savedChats];


    for (
        const savedChat of chats
    ) {

        await deleteCloudChat(
            savedChat.id
        );
    }
}


// ======================================================
// SAVE CHAT
// ======================================================

async function saveCurrentChat() {

    if (
        conversation.length === 0
    ) {
        return;
    }


    const firstUserMessage =
        conversation.find(
            item =>
                item.role === "user"
        );


    const title =
        firstUserMessage
            ? firstUserMessage.content
                .substring(0, 50)
            : "New conversation";


    if (!currentChatId) {

        currentChatId =
            Date.now().toString();
    }


    const chatData = {

        id:
            currentChatId,

        title:
            title,

        messages:
            conversation,

        language:
            languageSelect.value,

        createdAt:
            Date.now(),

        updatedAt:
            Date.now()
    };


    const index =
        savedChats.findIndex(
            item =>
                String(item.id) ===
                String(currentChatId)
        );


    if (index >= 0) {

        savedChats[index] =
            chatData;

    } else {

        savedChats.unshift(
            chatData
        );
    }


    if (currentUser) {

        await saveChatToCloud(
            chatData
        );

    } else {

        saveLocalChats(
            savedChats
        );
    }


    renderChatHistory();
}


// ======================================================
// CHAT HISTORY
// ======================================================

function renderChatHistory() {

    if (!chatHistory) {
        return;
    }


    chatHistory.innerHTML = "";


    if (
        savedChats.length === 0
    ) {

        chatHistory.innerHTML = `
            <div class="history-empty">
                No saved chats
            </div>
        `;

        return;
    }


    savedChats.forEach(
        savedChat => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "history-item";


            const title =
                document.createElement(
                    "span"
                );


            title.textContent =
                savedChat.title ||
                "Conversation";


            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.className =
                "delete-chat";


            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();

                    await deleteChat(
                        savedChat.id
                    );
                }
            );


            item.appendChild(
                title
            );

            item.appendChild(
                deleteButton
            );


            item.addEventListener(
                "click",
                () => {

                    loadChat(
                        savedChat.id
                    );
                }
            );


            chatHistory.appendChild(
                item
            );
        }
    );
}


// ======================================================
// LOAD CHAT
// ======================================================

function loadChat(id) {

    const savedChat =
        savedChats.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!savedChat) {
        return;
    }


    currentChatId =
        savedChat.id;


    conversation =
        Array.isArray(
            savedChat.messages
        )
            ? savedChat.messages
            : [];


    if (
        savedChat.language &&
        languageSelect
    ) {

        languageSelect.value =
            savedChat.language;
    }


    renderConversation();
}


// ======================================================
// DELETE CHAT
// ======================================================

async function deleteChat(id) {

    savedChats =
        savedChats.filter(
            item =>
                String(item.id) !==
                String(id)
        );


    if (currentUser) {

        await deleteCloudChat(
            id
        );

    } else {

        saveLocalChats(
            savedChats
        );
    }


    if (
        String(currentChatId) ===
        String(id)
    ) {

        startNewChat();
    }


    renderChatHistory();
}


// ======================================================
// DELETE ALL
// ======================================================

if (deleteAllChats) {

    deleteAllChats.addEventListener(
        "click",
        async () => {

            if (
                !confirm(
                    "Delete all your saved chats?"
                )
            ) {
                return;
            }


            if (currentUser) {

                await deleteAllCloudChats();

            }


            savedChats = [];

            saveLocalChats([]);

            conversation = [];

            currentChatId = null;

            renderChatHistory();

            showWelcome();
        }
    );
}


// ======================================================
// THEME
// ======================================================

function applyTheme() {

    document.body.classList.toggle(
        "light-theme",
        currentTheme === "light"
    );


    if (themeButton) {

        themeButton.textContent =
            currentTheme === "dark"
                ? "Light Mode"
                : "Dark Mode";
    }
}


if (themeButton) {

    themeButton.addEventListener(
        "click",
        () => {

            currentTheme =
                currentTheme === "dark"
                    ? "light"
                    : "dark";


            localStorage.setItem(
                "seekTheme",
                currentTheme
            );


            applyTheme();
        }
    );
}


applyTheme();


// ======================================================
// DISPLAY
// ======================================================

function addMessage(text, type) {

    const message =
        document.createElement(
            "div"
        );


    message.className =
        `message ${type}`;


    message.textContent =
        text;


    chat.appendChild(
        message
    );


    chat.scrollTop =
        chat.scrollHeight;


    return message;
}


function showWelcome() {

    chat.innerHTML = `
        <div class="welcome">

            <div class="welcome-logo">
                S
            </div>

            <h1>
                How can I help you?
            </h1>

            <p>
                Ask Seek AI anything.
            </p>

            <div class="suggestions">

                <button
                    class="suggestion"
                    type="button"
                    data-text="Explain something difficult in a simple way.">
                    Explain something
                </button>

                <button
                    class="suggestion"
                    type="button"
                    data-text="Write a creative short story.">
                    Write something
                </button>

                <button
                    class="suggestion"
                    type="button"
                    data-text="Give me creative ideas for a project.">
                    Give me ideas
                </button>

            </div>

        </div>
    `;

    setupSuggestions();
}


function removeWelcome() {

    const welcome =
        document.querySelector(
            ".welcome"
        );


    if (welcome) {
        welcome.remove();
    }
}


function renderConversation() {

    chat.innerHTML = "";


    if (
        conversation.length === 0
    ) {

        showWelcome();

        return;
    }


    conversation.forEach(
        item => {

            addMessage(
                item.content,

                item.role === "user"
                    ? "user"
                    : "ai"
            );
        }
    );
}


// ======================================================
// NEW CHAT
// ======================================================

function startNewChat() {

    conversation = [];

    currentChatId = null;

    messageInput.value = "";

    showWelcome();

    messageInput.focus();
}


if (newChatButton) {

    newChatButton.addEventListener(
        "click",
        startNewChat
    );
}


// ======================================================
// LANGUAGE
// ======================================================

function getLanguageInstruction(
    language
) {

    const instructions = {

        English:
            "Answer naturally and completely in English.",

        Persian:
            "فقط به زبان فارسی روان و طبیعی پاسخ بده.",

        Arabic:
            "أجب باللغة العربية بشكل طبيعي وواضح.",

        Spanish:
            "Responde completamente en español.",

        French:
            "Réponds entièrement en français.",

        German:
            "Antworte vollständig auf Deutsch.",

        Italian:
            "Rispondi completamente in italiano.",

        Portuguese:
            "Responda completamente em português.",

        Russian:
            "Отвечай полностью на русском языке.",

        Chinese:
            "请使用中文回答。",

        Japanese:
            "日本語で自然に回答してください。",

        Korean:
            "한국어로 자연스럽게 답변하세요.",

        Hindi:
            "हिंदी में स्वाभाविक रूप से उत्तर दें।",

        Turkish:
            "Tamamen Türkçe cevap ver.",

        Dutch:
            "Antwoord volledig in het Nederlands.",

        Polish:
            "Odpowiadaj całkowicie po polsku.",

        Ukrainian:
            "Відповідай повністю українською мовою.",

        Greek:
            "Απάντησε πλήρως στα Ελληνικά.",

        Hebrew:
            "ענה בעברית באופן טבעי וברור.",

        Indonesian:
            "Jawab sepenuhnya in Bahasa Indonesia.",

        Vietnamese:
            "Hãy trả lời hoàn toàn bằng tiếng Việt.",

        Thai:
            "ตอบเป็นภาษาไทยอย่างเป็นธรรมชาติ"
    };


    return (
        instructions[language] ||
        instructions.English
    );
}


if (languageSelect) {

    languageSelect.addEventListener(
        "change",
        () => {

            localStorage.setItem(
                "seekLanguage",
                languageSelect.value
            );


            messageInput.placeholder =
                `Message Seek AI in ${languageSelect.value}...`;
        }
    );
}


// ======================================================
// SYSTEM PROMPT
// ======================================================

function buildSystemPrompt(
    language
) {

    return `
You are Seek AI, the AI assistant of the Seek AI application.

IDENTITY:
- Your name is ALWAYS Seek AI.
- If the user asks who you are or what your name is, say you are Seek AI.
- Do not introduce yourself using the underlying model's name.
- Do not claim to be Groq, OpenAI, Meta, Google, or another provider.
- If the user specifically asks how Seek AI is powered, answer honestly.

LANGUAGE:
${getLanguageInstruction(language)}

BEHAVIOR:
- Be intelligent, accurate, helpful and natural.
- Use the complete conversation context.
- Answer directly.
- Do not invent facts.
- If unsure, say so clearly.
`;
}


// ======================================================
// SEND MESSAGE
// ======================================================

async function sendMessage(
    customText = null
) {

    const text =
        (
            customText !== null
                ? customText
                : messageInput.value
        ).trim();


    if (
        !text ||
        sendButton.disabled
    ) {
        return;
    }


    removeWelcome();


    addMessage(
        text,
        "user"
    );


    messageInput.value =
        "";


    sendButton.disabled =
        true;


    const aiMessage =
        addMessage(
            "Seek AI is thinking...",
            "ai"
        );


    conversation.push({
        role: "user",
        content: text
    });


    await saveCurrentChat();


    try {

        const response =
            await fetch(
                AI_URL,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            messages: [

                                {
                                    role:
                                        "system",

                                    content:
                                        buildSystemPrompt(
                                            languageSelect.value
                                        )
                                },

                                ...conversation
                            ]
                        })
                }
            );


        if (!response.ok) {

            const errorData =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );


            throw new Error(
                errorData?.error ||
                `Worker error: HTTP ${response.status}`
            );
        }


        if (!response.body) {

            throw new Error(
                "Streaming is not available."
            );
        }


        const reader =
            response.body.getReader();


        const decoder =
            new TextDecoder(
                "utf-8"
            );


        let buffer = "";
        let fullAnswer = "";


        while (true) {

            const {
                value,
                done
            } =
                await reader.read();


            if (done) {
                break;
            }


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream:
                            true
                    }
                );


            const lines =
                buffer.split("\n");


            buffer =
                lines.pop() || "";


            for (
                const line of lines
            ) {

                const trimmed =
                    line.trim();


                if (
                    !trimmed.startsWith(
                        "data:"
                    )
                ) {
                    continue;
                }


                const data =
                    trimmed.substring(5).trim();


                if (
                    data === "[DONE]"
                ) {
                    continue;
                }


                try {

                    const json =
                        JSON.parse(data);


                    const token =
                        json
                            ?.choices
                            ?.[0]
                            ?.delta
                            ?.content ||
                        "";


                    if (token) {

                        fullAnswer +=
                            token;


                        aiMessage.textContent =
                            fullAnswer;


                        chat.scrollTop =
                            chat.scrollHeight;
                    }

                } catch {
                    // Ignore incomplete chunks.
                }
            }
        }


        if (
            !fullAnswer.trim()
        ) {

            fullAnswer =
                "Sorry, I didn't receive an answer.";

            aiMessage.textContent =
                fullAnswer;
        }


        conversation.push({
            role: "assistant",
            content: fullAnswer
        });


        await saveCurrentChat();


        if (
            voiceEnabled &&
            fullAnswer.trim()
        ) {

            speakText(
                fullAnswer,
                languageSelect.value
            );
        }


    } catch (error) {

        console.error(
            "Seek AI error:",
            error
        );


        aiMessage.textContent =
            "Seek AI couldn't connect right now.\n\n" +
            error.message;
    }


    sendButton.disabled =
        false;


    messageInput.focus();
}


// ======================================================
// SEND EVENTS
// ======================================================

if (sendButton) {

    sendButton.addEventListener(
        "click",
        () => {
            sendMessage();
        }
    );
}


if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}


// ======================================================
// SUGGESTIONS
// ======================================================

function setupSuggestions() {

    document
        .querySelectorAll(
            ".suggestion"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        sendMessage(
                            button.dataset.text
                        );
                    }
                );
            }
        );
}


// ======================================================
// MICROPHONE
// ======================================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


if (
    SpeechRecognition &&
    micButton
) {

    recognition =
        new SpeechRecognition();


    recognition.continuous =
        false;

    recognition.interimResults =
        false;


    recognition.onstart =
        () => {

            isListening =
                true;

            micButton.classList.add(
                "listening"
            );

            micButton.textContent =
                "Stop";
        };


    recognition.onresult =
        event => {

            const text =
                event
                    .results[0][0]
                    .transcript;


            messageInput.value =
                text;


            sendMessage();
        };


    recognition.onend =
        () => {

            isListening =
                false;

            micButton.classList.remove(
                "listening"
            );

            micButton.textContent =
                "Mic";
        };


    recognition.onerror =
        event => {

            console.error(
                "Microphone error:",
                event.error
            );

            isListening =
                false;

            micButton.classList.remove(
                "listening"
            );

            micButton.textContent =
                "Mic";
        };


    micButton.addEventListener(
        "click",
        () => {

            if (isListening) {

                recognition.stop();

                return;
            }


            recognition.lang =
                getSpeechLanguage(
                    languageSelect.value
                );


            try {

                recognition.start();

            } catch (error) {

                console.error(
                    "Microphone start error:",
                    error
                );
            }
        }
    );

} else if (micButton) {

    micButton.addEventListener(
        "click",
        () => {

            alert(
                "Voice input is not supported in this browser."
            );
        }
    );
}


function getSpeechLanguage(
    language
) {

    const languages = {

        English: "en-US",
        Persian: "fa-IR",
        Arabic: "ar-SA",
        Spanish: "es-ES",
        French: "fr-FR",
        German: "de-DE",
        Italian: "it-IT",
        Portuguese: "pt-PT",
        Russian: "ru-RU",
        Chinese: "zh-CN",
        Japanese: "ja-JP",
        Korean: "ko-KR",
        Hindi: "hi-IN",
        Turkish: "tr-TR",
        Dutch: "nl-NL",
        Polish: "pl-PL",
        Ukrainian: "uk-UA",
        Greek: "el-GR",
        Hebrew: "he-IL",
        Indonesian: "id-ID",
        Vietnamese: "vi-VN",
        Thai: "th-TH"
    };


    return (
        languages[language] ||
        "en-US"
    );
}


// ======================================================
// VOICE
// ======================================================

function speakText(
    text,
    language
) {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }


    speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            text
        );


    utterance.lang =
        getSpeechLanguage(
            language
        );


    utterance.rate =
        1;

    utterance.pitch =
        1;


    speechSynthesis.speak(
        utterance
    );
}


if (voiceButton) {

    voiceButton.addEventListener(
        "click",
        () => {

            voiceEnabled =
                !voiceEnabled;


            localStorage.setItem(
                "seekVoiceEnabled",
                voiceEnabled
            );


            voiceButton.textContent =
                voiceEnabled
                    ? "Voice: ON"
                    : "Voice: OFF";


            if (
                !voiceEnabled &&
                "speechSynthesis" in window
            ) {

                speechSynthesis.cancel();
            }
        }
    );
}


// ======================================================
// MEMORY
// ======================================================

if (memoryButton) {

    memoryButton.addEventListener(
        "click",
        () => {

            if (!memoryContent) {
                return;
            }


            memoryContent.textContent =
                currentUser
                    ? `Signed in as ${currentUser.email}. Your chats are stored in your account.`
                    : "You are not signed in. Chats are stored on this browser.";


            if (memoryModal) {

                memoryModal.classList.remove(
                    "hidden"
                );
            }
        }
    );
}


if (closeMemory) {

    closeMemory.addEventListener(
        "click",
        () => {

            memoryModal.classList.add(
                "hidden"
            );
        }
    );
}


if (clearMemory) {

    clearMemory.addEventListener(
        "click",
        async () => {

            if (
                !confirm(
                    "Delete all your saved chats?"
                )
            ) {
                return;
            }


            if (currentUser) {

                await deleteAllCloudChats();
            }


            savedChats = [];

            saveLocalChats([]);

            conversation = [];

            currentChatId = null;


            renderChatHistory();

            showWelcome();


            if (memoryModal) {

                memoryModal.classList.add(
                    "hidden"
                );
            }
        }
    );
}


// ======================================================
// STARTUP
// ======================================================

const savedLanguage =
    localStorage.getItem(
        "seekLanguage"
    );


if (
    savedLanguage &&
    languageSelect
) {

    languageSelect.value =
        savedLanguage;
}


if (messageInput) {

    messageInput.placeholder =
        `Message Seek AI in ${languageSelect.value}...`;
}


if (voiceButton) {

    voiceButton.textContent =
        voiceEnabled
            ? "Voice: ON"
            : "Voice: OFF";
}


savedChats =
    getLocalChats();


renderChatHistory();


showWelcome();


// ======================================================
// FIREBASE READY
// ======================================================

window.addEventListener(
    "firebaseReady",
    initializeFirebaseConnection
);


// Try immediately too
// in case Firebase loaded first.

initializeFirebaseConnection();