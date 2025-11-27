import './style.css'

const apiKey = import.meta.env.VITE_OPENAI_API_KEY
const systemPrompt =
  '당신은 인생의 흐름을 한 문장에 담아내는 고전 명문장 큐레이터입니다. ' +
  '단순한 번역이 아니라, 질문자의 심정을 헤아려 동양과 서양 고전의 문장을 활용해 통찰력 있는 답변을 제공하세요. ' +
  '응답은 한국어로 자연스럽게 작성하고, 명문장을 적절히 인용하여 구성합니다.'

const highlightQuotes = [
  { text: '천 리 길도 한 걸음부터.', author: '노자, 도덕경' },
  { text: '나는 생각한다, 고로 존재한다.', author: '데카르트, 방법서설' },
  { text: '배움은 쉼 없이 점검하는 것이다.', author: '공자' },
  { text: '바람이 불지 않을 때 연을 만들고, 바람이 불 때 날리는 것이 인생.', author: '마르쿠스 아우렐리우스' }
]

const quoteCardsMarkup = highlightQuotes
  .map(
    (quote) => `
      <article class="quote-card">
        <p>“${quote.text}”</p>
        <small>${quote.author}</small>
      </article>
    `
  )
  .join('')

const app = document.querySelector('#app')
app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">인생일력 추천</p>
        <h1>고전 명문 챗봇</h1>
      </div>
      <div class="status-pill" aria-live="polite">
        <span class="status-dot pending" id="api-status-dot"></span>
        <span id="api-status-text">API 키 확인 중...</span>
      </div>
    </header>
    <section class="intro-card">
      <p>
        질문을 입력하면 시공을 넘나드는 고전 명문장을 추천하고, 그 철학적 의미를 해석해주는 대화를 이어갑니다.
        맥락을 기억하는 챗봇으로 대화할수록 맞춤 명문장이 쌓입니다.
      </p>
      <div class="quote-grid">
        ${quoteCardsMarkup}
      </div>
    </section>
    <section class="chat-panel">
      <div id="chat-log" class="chat-log scroll-fade" aria-live="polite"></div>
      <form id="chat-form" class="chat-form">
        <input
          id="chat-input"
          name="prompt"
          type="text"
          placeholder="오늘의 흐름을 물어보고 싶은 문장을 입력하세요"
          autocomplete="off"
          required
        />
        <button type="submit">보내기</button>
      </form>
    </section>
  </div>
`

const chatLog = document.getElementById('chat-log')
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')
const chatButton = chatForm.querySelector('button')
const statusDot = document.getElementById('api-status-dot')
const statusText = document.getElementById('api-status-text')

const chatHistory = [{ role: 'system', content: systemPrompt }]
const MAX_HISTORY = 10
let isSending = false

const initialGreeting =
  '안녕하세요. 고전의 지혜를 꺼내 삶의 흐름을 짚어주는 인생일력 챗봇입니다. 질문을 주시면 관련 명문장과 그 맥락을 연결해 답변드릴게요.'

chatHistory.push({ role: 'assistant', content: initialGreeting })
appendMessage('assistant', initialGreeting)

setStatus('pending', 'API 키 확인 중...')
verifyApiKey()

chatForm.addEventListener('submit', (event) => {
  event.preventDefault()
  if (isSending) {
    return
  }
  const prompt = chatInput.value.trim()
  if (!prompt) {
    return
  }
  chatInput.value = ''
  chatInput.focus()
  sendMessage(prompt)
})

function appendMessage(role, text) {
  const bubble = document.createElement('div')
  bubble.className = `chat-bubble ${role}`
  bubble.textContent = text
  bubble.innerHTML = bubble.innerHTML.replace(/\n/g, '<br>')
  chatLog.appendChild(bubble)
  chatLog.scrollTop = chatLog.scrollHeight
  return bubble
}

function showTypingIndicator() {
  const indicator = document.createElement('div')
  indicator.className = 'chat-bubble assistant typing'
  indicator.textContent = '명문장을 다듬는 중입니다...'
  chatLog.appendChild(indicator)
  chatLog.scrollTop = chatLog.scrollHeight
  return indicator
}

function trimHistory() {
  const overflow = chatHistory.length - (MAX_HISTORY + 1)
  if (overflow > 0) {
    chatHistory.splice(1, overflow)
  }
}

function setStatus(state, message) {
  statusDot.classList.remove('success', 'error', 'pending')
  statusDot.classList.add(state)
  statusText.textContent = message
}

async function verifyApiKey() {
  if (!apiKey) {
    setStatus('error', 'API 키가 없습니다. .env에 VITE_OPENAI_API_KEY 추가 후 재시작하세요.')
    appendMessage(
      'system',
      '환경변수에 API 키가 없어서 OpenAI에 연결할 수 없습니다. 키를 추가한 뒤 새로고침하세요.'
    )
    chatInput.disabled = true
    chatButton.disabled = true
    return
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result?.error?.message ?? '응답 실패')
    }
    setStatus('success', 'API 키 정상 작동 중')
  } catch (error) {
    setStatus('error', `API 키 오류: ${error.message}`)
  }
}

async function sendMessage(prompt) {
  if (!apiKey) {
    appendMessage('system', 'API 키가 없어 응답할 수 없습니다.')
    return
  }

  isSending = true
  chatButton.disabled = true
  appendMessage('user', prompt)
  chatHistory.push({ role: 'user', content: prompt })
  trimHistory()
  const typingIndicator = showTypingIndicator()

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: chatHistory,
        temperature: 0.7,
        max_tokens: 512
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message ?? '응답 실패')
    }
    const assistantMessage = data.choices?.[0]?.message?.content?.trim() || '명문장을 찾지 못했습니다.'
    chatHistory.push({ role: 'assistant', content: assistantMessage })
    trimHistory()
    appendMessage('assistant', assistantMessage)
    setStatus('success', 'API 키 정상 작동 중')
  } catch (error) {
    appendMessage('system', `응답 중 오류가 발생했습니다. ${error.message}`)
    setStatus('error', '응답 처리 중 오류 발생')
  } finally {
    typingIndicator.remove()
    isSending = false
    chatButton.disabled = false
  }
}
