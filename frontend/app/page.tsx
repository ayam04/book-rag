"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, Send, Loader2, Plus, FileText, Trash2, MessageSquarePlus, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "next-themes"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  relevantPages?: number[]
}

interface ChatHistory {
  id: string
  fileName: string
  messages: ChatMessage[]
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [inputMessage, setInputMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false)
  const { theme, setTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)

  const activeChat = chatHistories.find((chat) => chat.id === activeChatId)

  const handleNewChat = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile)
      setIsUploading(true)

      const formData = new FormData()
      formData.append("file", selectedFile)

      try {
        const response = await fetch("http://localhost:8080/process-pdf", {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          const newChatId = Date.now().toString()
          setChatHistories((prev) => [
            ...prev,
            {
              id: newChatId,
              fileName: selectedFile.name,
              messages: [],
            },
          ])
          setActiveChatId(newChatId)
        } else {
          console.error("Error processing PDF")
        }
      } catch (error) {
        console.error("Error uploading file:", error)
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeChatId) return

    const userMessage = inputMessage
    setChatHistories((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "user", content: userMessage }],
            }
          : chat,
      ),
    )
    setInputMessage("")
    setIsSending(true)

    try {
      const chatContext =
        activeChat?.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })) || []

      const response = await fetch("http://localhost:8080/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userMessage,
          chat_context: chatContext,
        }),
      })

      const data = await response.json()
      setChatHistories((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role: "assistant",
                    content: data.message,
                    relevantPages: data.relevant_pages,
                  },
                ],
              }
            : chat,
        ),
      )
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const deleteChat = (chatId: string) => {
    setChatHistories((prev) => prev.filter((chat) => chat.id !== chatId))
    if (activeChatId === chatId) {
      setActiveChatId(null)
    }
  }

  const handleGenerateFollowUp = async () => {
    if (!activeChat) return
    const lastMessage = activeChat.messages[activeChat.messages.length - 1]
    if (lastMessage.role !== "assistant") return

    setIsGeneratingFollowUp(true)

    try {
      const response = await fetch("http://localhost:8080/generate-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_text: lastMessage.content,
        }),
      })

      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        setChatHistories((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    {
                      role: "assistant",
                      content: "Here are some follow-up questions you can ask:\n" + data.join("\n"),
                    },
                  ],
                }
              : chat,
          ),
        )
      }
    } catch (error) {
      console.error("Error generating follow-up questions:", error)
    } finally {
      setIsGeneratingFollowUp(false)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  useEffect(() => {
    setIsMounted(true)
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [setTheme])

  if (!isMounted) {
    return null // or a loading spinner
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 border-r border-border bg-card">
        <div className="p-4">
          <Button className="w-full gap-2" variant="outline" onClick={handleNewChat} disabled={isUploading}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isUploading ? "Uploading..." : "New Chat"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/pdf"
            onChange={handleFileUpload}
          />
        </div>
        <Separator />
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="p-2 space-y-2">
            {chatHistories.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full p-2 rounded-lg text-left group flex items-center justify-between ${
                  chat.id === activeChatId ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate text-sm">{chat.fileName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
          </Button>
        </div>
        {!activeChatId ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="p-8 max-w-md w-full mx-4">
              <div className="space-y-4 text-center">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <h2 className="text-2xl font-semibold">Upload a PDF to start chatting</h2>
                <p className="text-muted-foreground">
                  Click the "New Chat" button to upload a PDF file and start a new conversation
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold">{activeChat?.fileName}</h1>
            </div>
            <Card className="flex-1 p-4 mb-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {activeChat?.messages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {message.content}
                        {message.relevantPages && message.relevantPages.length > 0 && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Found on page(s): {message.relevantPages.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about your PDF..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isSending}
              />
              <Button onClick={handleSendMessage} disabled={isSending}>
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
              {activeChat && activeChat.messages.length > 0 &&
                activeChat.messages[activeChat.messages.length - 1].role === "assistant" && (
                  <Button onClick={handleGenerateFollowUp} disabled={isGeneratingFollowUp}>
                    {isGeneratingFollowUp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="w-4 h-4" />
                    )}
                  </Button>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

