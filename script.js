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


// ======================================
// CLOUDFLARE WORKER
// ======================================

const AI_URL =
    "https://seek-ai-server.samyaruserdr2.workers.dev";


// ======================================
// STATE
// ======================================

let conversation = [];
let currentChatId = null;

let voiceEnabled =
    localStorage.getItem("seekVoiceEnabled") !== "false";

let currentTheme =
    localStorage.getItem("seekTheme") || "dark";

let recognition = null;
let isListening = false;


// ======================================
// THEME
// ======================================

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


// ======================================
// STORAGE
// ======================================

function getSavedChats() {

    try {

        return JSON.parse(
            localStorage.getItem("seekChats") || "[]"
        );

    } catch {

        return [];
    }
}


function saveChats(chats) {

    localStorage.setItem(
        "seekChats",
        JSON.stringify(chats)
    );
}


// ======================================
// SAVE CHAT
// ======================================

function saveCurrentChat() {

    if (conversation.length === 0) {
        return;
    }

    const chats = getSavedChats();

    const firstUserMessage =
        conversation.find(
            item => item.role === "user"
        );

    const title =
        firstUserMessage
            ? firstUserMessage.content.substring(0, 50)
            : "New conversation";


    if (!currentChatId) {

        currentChatId =
            Date.now().toString();

        chats.unshift({

            id: currentChatId,

            title: title,

            messages: conversation,

            language: languageSelect.value,

            createdAt:
                new Date().toISOString()
        });

    } else {

        const index =
            chats.findIndex(
                item => item.id === currentChatId
            );

        if (index !== -1) {

            chats[index].messages =
                conversation;

            chats[index].language =
                languageSelect.value;
        }
    }

    saveChats(chats);

    renderChatHistory();
}


// ======================================
// CHAT HISTORY
// ======================================

function renderChatHistory() {

    if (!chatHistory) {
        return;
    }

    const chats = getSavedChats();

    chatHistory.innerHTML = "";

    if (chats.length === 0) {

        chatHistory.innerHTML = `
            <div class="history-empty">
                No saved chats
            </div>
        `;

        return;
    }


    chats.forEach(savedChat => {

        const item =
            document.createElement("div");

        item.className =
            "history-item";


        const title =
            document.createElement("span");

        title.textContent =
            savedChat.title;


        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "delete-chat";

        deleteButton.textContent =
            "Delete";


        deleteButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                deleteChat(
                    savedChat.id
                );
            }
        );


        item.appendChild(title);

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
    });
}


// ======================================
// LOAD CHAT
// ======================================

function loadChat(id) {

    const chats =
        getSavedChats();

    const savedChat =
        chats.find(
            item => item.id === id
        );

    if (!savedChat) {
        return;
    }


    currentChatId =
        savedChat.id;

    conversation =
        Array.isArray(savedChat.messages)
            ? savedChat.messages
            : [];


    languageSelect.value =
        savedChat.language || "English";


    renderConversation();
}


// ======================================
// DELETE CHAT
// ======================================

function deleteChat(id) {

    const chats =
        getSavedChats().filter(
            item => item.id !== id
        );

    saveChats(chats);


    if (
        currentChatId === id
    ) {

        startNewChat();
    }


    renderChatHistory();
}


if (deleteAllChats) {

    deleteAllChats.addEventListener(
        "click",
        () => {

            if (
                !confirm(
                    "Delete all saved chats?"
                )
            ) {
                return;
            }


            localStorage.removeItem(
                "seekChats"
            );


            startNewChat();

            renderChatHistory();
        }
    );
}


// ======================================
// MESSAGE DISPLAY
// ======================================

function addMessage(
    text,
    type
) {

    const message =
        document.createElement("div");

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


// ======================================
// WELCOME
// ======================================

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
                    data-text="Explain something difficult in a simple way.">

                    Explain something

                </button>


                <button
                    class="suggestion"
                    data-text="Write a creative short story.">

                    Write something

                </button>


                <button
                    class="suggestion"
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


// ======================================
// NEW CHAT
// ======================================

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


// ======================================
// LANGUAGES
// ======================================

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
            "Jawab sepenuhnya dalam bahasa Indonesia.",

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


// ======================================
// SYSTEM PROMPT
// ======================================

function buildSystemPrompt(
    language
) {

    return `
You are Seek AI, the AI assistant of the Seek AI application.

IDENTITY:
- Your public assistant name is ALWAYS "Seek AI".
- If the user asks "Who are you?", "What's your name?", "What are you?", or "Introduce yourself", say that you are Seek AI, their AI assistant.
- Do not introduce yourself using the underlying model's name.
- Do not claim to be Meta, OpenAI, Groq, NVIDIA, Google, or another provider.
- Do not mention Groq unless the user specifically asks how Seek AI is powered.
- If the user explicitly asks which underlying model powers Seek AI, answer honestly.

LANGUAGE:
${getLanguageInstruction(language)}

BEHAVIOR:
- Be intelligent, accurate, helpful and natural.
- Use previous conversation context.
- Answer the user's actual question directly.
- Do not unnecessarily repeat the question.
- Do not invent facts.
- If you are uncertain, say so clearly.
- Keep simple questions concise.
- Give more detail when useful.
`;
}


// ======================================
// SEND MESSAGE
// ======================================

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


    messageInput.value = "";

    sendButton.disabled = true;


    const aiMessage =
        addMessage(
            "Seek AI is thinking...",
            "ai"
        );


    conversation.push({

        role: "user",

        content: text
    });


    saveCurrentChat();


    const language =
        languageSelect.value;


    try {

        const response =
            await fetch(
                AI_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        messages: [

                            {
                                role:
                                    "system",

                                content:
                                    buildSystemPrompt(
                                        language
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
                        stream: true
                    }
                );


            const lines =
                buffer.split("\n");


            buffer =
                lines.pop() || "";


            for (
                const line
                of lines
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
                    trimmed
                        .substring(5)
                        .trim();


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

                    // Ignore incomplete SSE chunks.
                }
            }
        }


        if (
            !fullAnswer.trim()
        ) {

            aiMessage.textContent =
                "Sorry, I didn't receive an answer.";
        }


        conversation.push({

            role:
                "assistant",

            content:
                fullAnswer
        });


        saveCurrentChat();


        if (
            voiceEnabled &&
            fullAnswer.trim()
        ) {

            speakText(
                fullAnswer,
                language
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


    sendButton.disabled = false;

    messageInput.focus();
}


// ======================================
// SEND BUTTON
// ======================================

if (sendButton) {

    sendButton.addEventListener(
        "click",
        () => {

            sendMessage();
        }
    );
}


// ======================================
// ENTER KEY
// ======================================

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


// ======================================
// SUGGESTIONS
// ======================================

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


// ======================================
// MICROPHONE
// ======================================

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

            isListening = true;

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

            isListening = false;

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

            isListening = false;

            micButton.classList.remove(
                "listening"
            );

            micButton.textContent =
                "Mic";
        };


    micButton.addEventListener(
        "click",
        () => {

            if (
                isListening
            ) {

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
                "Voice input is not supported in this browser. Try Chrome or Edge."
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


// ======================================
// VOICE OUTPUT
// ======================================

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


    utterance.rate = 1;
    utterance.pitch = 1;


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


// ======================================
// MEMORY
// ======================================

if (memoryButton) {

    memoryButton.addEventListener(
        "click",
        () => {

            const chats =
                getSavedChats();


            if (!memoryContent) {
                return;
            }


            memoryContent.textContent =
                chats.length
                    ? `${chats.length} saved conversations are stored in this browser.`
                    : "No saved conversations.";


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
        () => {

            if (
                !confirm(
                    "Delete all saved memory and chats?"
                )
            ) {
                return;
            }


            localStorage.removeItem(
                "seekChats"
            );


            conversation = [];

            currentChatId = null;


            renderChatHistory();

            startNewChat();


            memoryModal.classList.add(
                "hidden"
            );
        }
    );
}


// ======================================
// STARTUP
// ======================================

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


renderChatHistory();

showWelcome();