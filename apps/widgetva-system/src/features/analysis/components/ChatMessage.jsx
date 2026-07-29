import { readMessageText } from '../utils/agentPayloadFormatting.js'

export default function ChatMessage({ message }) {
  const role = message?.role || 'assistant'
  const text = readMessageText(message)
  if (!text.trim()) return null
  return (
    <div className={`agent-chat-row ${role}`}>
      <div className={`chat-bubble ${role}`}>
        <p>{text}</p>
      </div>
    </div>
  )
}
