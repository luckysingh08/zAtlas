import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { getMessages, sendMessage, getFiles, uploadFile, getFileDownloadUrl } from '../lib/data'
import { Message, FileRecord } from '../types'

type Tab = 'chat' | 'files' | 'alerts'

export default function ChatFilesAlerts() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const isGuardian = profile?.role === 'guardian'
  const [tab, setTab] = useState<Tab>('chat')

  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [alertMessages, setAlertMessages] = useState<Message[]>([])
  const [chatText, setChatText] = useState('')
  const [alertText, setAlertText] = useState('')
  const [files, setFiles] = useState<FileRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  async function loadAll() {
    if (!profile?.group_id) return
    const [chat, alerts, fileList] = await Promise.all([
      getMessages(profile.group_id, 'chat'),
      getMessages(profile.group_id, 'alert'),
      getFiles(profile.group_id),
    ])
    setChatMessages(chat)
    setAlertMessages(alerts)
    setFiles(fileList)
  }

  useEffect(() => { loadAll() }, [profile?.group_id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Realtime listener: live sync + native OS notification for alerts
  useEffect(() => {
    if (!profile?.group_id) return

    const channel = supabase
      .channel(`messages-${profile.group_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${profile.group_id}` },
        async (payload) => {
          const msg = payload.new as Message
          if (msg.type === 'chat') {
            setChatMessages((prev) => [...prev, msg])
          } else if (msg.type === 'alert') {
            setAlertMessages((prev) => [...prev, msg])
            // Fire a native OS notification, but not for messages we sent ourselves
            if (msg.sender_id !== user?.id && 'Notification' in window) {
              let permission = Notification.permission
              if (permission !== 'granted' && permission !== 'denied') {
                permission = await Notification.requestPermission()
              }
              if (permission === 'granted') {
                new Notification('zAtlas Alert', { body: msg.text })
              }
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.group_id, user?.id])

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.group_id || !user || !chatText.trim()) return
    await sendMessage(profile.group_id, user.id, chatText.trim(), 'chat')
    setChatText('')
  }

  async function handleSendAlert(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.group_id || !user || !alertText.trim()) return
    await sendMessage(profile.group_id, user.id, alertText.trim(), 'alert')
    setAlertText('')
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile?.group_id || !user) return
    setUploading(true)
    try {
      await uploadFile(profile.group_id, user.id, file)
      await loadAll()
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDownload(file: FileRecord) {
    const url = await getFileDownloadUrl(file.url)
    window.open(url, '_blank')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'files', label: 'Files' },
    { id: 'alerts', label: 'Alerts' },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8 flex flex-col">
      <button onClick={() => navigate('/dashboard')} className="text-gray-400 mb-4 text-sm">← Back to Dashboard</button>
      <h1 className="text-2xl font-semibold mb-4">Chat, Files & Alerts</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm border ${
              tab === t.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-gray-700 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="flex flex-col max-w-xl flex-1">
          <div className="flex-1 overflow-y-auto bg-[var(--card)] rounded-lg p-4 mb-3 min-h-[300px] max-h-[400px] space-y-2">
            {chatMessages.map((m) => (
              <div key={m.id} className={`text-sm ${m.sender_id === user?.id ? 'text-right' : 'text-left'}`}>
                <span className={`inline-block px-3 py-1.5 rounded-lg ${m.sender_id === user?.id ? 'bg-[#00E5FF] text-black' : 'bg-[var(--bg)] text-[var(--text)]'}`}>
                  {m.text}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              className="flex-1 bg-transparent border border-gray-700 rounded-lg px-4 py-2 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
            />
            <button type="submit" className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2 text-sm">Send</button>
          </form>
        </div>
      )}

      {tab === 'files' && (
        <div className="max-w-xl">
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" id="file-upload" />
          <label
            htmlFor="file-upload"
            className="inline-block bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2 text-sm cursor-pointer mb-4"
          >
            {uploading ? 'Uploading...' : '+ Upload File'}
          </label>
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="bg-[var(--card)] rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm">{f.name}</span>
                <button onClick={() => handleDownload(f)} className="text-[#00E5FF] text-sm">Download</button>
              </div>
            ))}
            {files.length === 0 && <p className="text-gray-500 text-sm">No files yet.</p>}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="max-w-xl">
          {isGuardian && (
            <form onSubmit={handleSendAlert} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Send an alert to student..."
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                className="flex-1 bg-transparent border border-gray-700 rounded-lg px-4 py-2 text-[#FAFAFA] placeholder-gray-500 focus:outline-none focus:border-[#00E5FF]"
              />
              <button type="submit" className="bg-[#00E5FF] text-black font-medium rounded-lg px-4 py-2 text-sm">Send</button>
            </form>
          )}
          <div className="space-y-2">
            {alertMessages.map((m) => (
              <div key={m.id} className="bg-[var(--card)] rounded-lg p-3 text-sm">
                {m.text}
              </div>
            ))}
            {alertMessages.length === 0 && <p className="text-gray-500 text-sm">No alerts yet.</p>}
          </div>
        </div>
      )}
    </div>
  )
}