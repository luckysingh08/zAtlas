import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import { deleteFile, deleteMessage, getMessages, sendMessage, getFiles, uploadFile, getFileDownloadUrl } from '../lib/data'
import { FileRecord, Message } from '../types'
import AppShell, { Icon } from '../components/AppShell'

type Tab = 'chat' | 'files' | 'alerts'

function appendMessage(items: Message[], message: Message) {
  return items.some((item) => item.id === message.id) ? items : [...items, message]
}

export default function ChatFilesAlerts() {
  const { profile, user } = useAuth()
  const guardian = profile?.role === 'guardian'
  const [tab, setTab] = useState<Tab>('chat')
  const [chat, setChat] = useState<Message[]>([])
  const [alerts, setAlerts] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [alertText, setAlertText] = useState('')
  const [files, setFiles] = useState<FileRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const end = useRef<HTMLDivElement>(null)

  async function load() {
    if (!profile?.group_id) return
    setError('')
    try {
      const [nextChat, nextAlerts, nextFiles] = await Promise.all([
        getMessages(profile.group_id, 'chat'),
        getMessages(profile.group_id, 'alert'),
        getFiles(profile.group_id),
      ])
      setChat(nextChat)
      setAlerts(nextAlerts)
      setFiles(nextFiles)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your shared space.')
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setError('Browser alerts are not supported in this browser.')
      return
    }
    const permission = await Notification.requestPermission()
    setNotice(permission === 'granted' ? 'Browser alerts are enabled for zAtlas.' : 'Browser alerts are currently blocked.')
  }

  useEffect(() => { void load() }, [profile?.group_id])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])
  useEffect(() => {
    if (!profile?.group_id) return
    const channel = supabase.channel(`messages-${profile.group_id}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${profile.group_id}` },
      ({ new: raw }) => {
        const message = raw as Message
        if (message.type === 'chat') setChat((items) => appendMessage(items, message))
        else {
          setAlerts((items) => appendMessage(items, message))
          if (message.sender_id !== user?.id && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('zAtlas alert', { body: message.text })
          }
        }
      },
    ).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile?.group_id, user?.id])

  async function send(event: React.FormEvent, type: Tab = 'chat') {
    event.preventDefault()
    const value = type === 'chat' ? text : alertText
    if (!profile?.group_id || !user || !value.trim()) return
    setError('')
    try {
      const message = await sendMessage(profile.group_id, user.id, value.trim(), type === 'alerts' ? 'alert' : 'chat')
      if (type === 'chat') {
        setChat((items) => appendMessage(items, message))
        setText('')
      } else {
        setAlerts((items) => appendMessage(items, message))
        setAlertText('')
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Your message could not be sent.')
    }
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !profile?.group_id || !user) return
    setUploading(true)
    setError('')
    try {
      const record = await uploadFile(profile.group_id, user.id, file)
      setFiles((items) => [record, ...items.filter((item) => item.id !== record.id)])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The file could not be uploaded.')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  async function openFile(path: string) {
    try {
      const url = await getFileDownloadUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'The file could not be opened.')
    }
  }

  async function removeMessage(message: Message) {
    setError('')
    try {
      await deleteMessage(message.id)
      if (message.type === 'chat') setChat((items) => items.filter((item) => item.id !== message.id))
      else setAlerts((items) => items.filter((item) => item.id !== message.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The message could not be deleted.')
    }
  }

  async function removeFile(file: FileRecord) {
    setError('')
    try {
      await deleteFile(file)
      setFiles((items) => items.filter((item) => item.id !== file.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The file could not be deleted.')
    }
  }

  useEffect(() => {
    if (!profile?.group_id) return
    const refresh = window.setInterval(() => { void load() }, 8000)
    return () => window.clearInterval(refresh)
  }, [profile?.group_id])

  const tabs: [Tab, string][] = [['chat', 'Chat'], ['files', 'Files'], ['alerts', 'Alerts']]
  const canRequestNotifications = !guardian && 'Notification' in window && Notification.permission !== 'granted'

  return <AppShell title="Stay in the loop." eyebrow="Shared space" variant="inbox"><section className="surface connect-layout"><aside className="connect-tabs">{tabs.map(([id, label]) => <button className={`connect-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} key={id}><span className="tab-dot" /><span>{label}</span></button>)}</aside><main className="connect-main">
    {tab === 'chat' && <><div className="messages">{chat.map((message) => <div className={`message ${message.sender_id === user?.id ? 'own' : ''}`} key={message.id}><span>{message.text}</span>{message.sender_id === user?.id && <button className="message-delete" aria-label="Delete message" onClick={() => void removeMessage(message)}>×</button>}</div>)}{!chat.length && <p className="empty">Your shared conversation starts here.</p>}<div ref={end} /></div><form className="form-row" onSubmit={(event) => void send(event)}><input className="field" placeholder="Write a note…" value={text} onChange={(event) => setText(event.target.value)} /><button className="btn btn-primary">Send</button></form></>}
    {tab === 'files' && <><div className="subject-top"><div><h2 className="surface-title">Files</h2><p className="muted tiny">A single, shared reference shelf.</p></div><input ref={input} hidden type="file" onChange={(event) => void upload(event)} /><button className="btn btn-primary" onClick={() => input.current?.click()}>{uploading ? 'Uploading…' : 'Upload file'}</button></div><div>{files.map((file) => <div className="file-row" key={file.id}><div className="file-token"><span className="file-glyph">↗</span>{file.name}</div><div className="file-actions"><button className="btn" onClick={() => void openFile(file.url)}>Open</button>{file.uploader_id === user?.id && <button className="text-button" onClick={() => void removeFile(file)}>Delete</button>}</div></div>)}{!files.length && <p className="empty">Nothing has been shared yet.</p>}</div></>}
    {tab === 'alerts' && <><div className="subject-top"><div><h2 className="surface-title">Alerts</h2><p className="muted tiny">Important moments, kept simple.</p></div><Icon name="spark" /></div>{guardian && <form className="form-row" onSubmit={(event) => void send(event, 'alerts')}><input className="field" placeholder="Share an important update" value={alertText} onChange={(event) => setAlertText(event.target.value)} /><button className="btn btn-primary">Send</button></form>}{canRequestNotifications && <button className="btn" onClick={() => void enableNotifications()}>Enable browser alerts</button>}<div style={{ marginTop: 15 }}>{alerts.map((alert) => <div className="alert-row" key={alert.id}><span>{alert.text}</span><div className="alert-actions"><span className="pill">Alert</span>{guardian && alert.sender_id === user?.id && <button className="text-button" onClick={() => void removeMessage(alert)}>Delete</button>}</div></div>)}{!alerts.length && <p className="empty">No alerts right now.</p>}</div></>}
    {notice && <p className="notice">{notice}</p>}{error && <p className="error">{error}</p>}
  </main></section></AppShell>
}
