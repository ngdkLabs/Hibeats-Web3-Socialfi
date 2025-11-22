import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Search,
  Send,
  MoreHorizontal,
  Music,
  Image,
  Paperclip,
  Smile,
  Phone,
  Video,
  Headphones
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NotificationDropdown from "@/components/NotificationDropdown";
import Navbar from "@/components/Navbar";
import { LiveChatMessage, realtimeChatService } from "@/services/realtimeChatService";

const Messages = () => {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(1);
  const [messageText, setMessageText] = useState("");
  const [latencyStats, setLatencyStats] = useState<{ average: number; latest: number } | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, LiveChatMessage[]>>({
    1: [
      {
        id: "seed-1",
        conversationId: "1",
        sender: "Jazz Fusion",
        content: "Hey! I just listened to your latest track 'Midnight Groove'",
        timestamp: Date.now() - 1000 * 60 * 15,
        status: "sent"
      },
      {
        id: "seed-2",
        conversationId: "1",
        sender: "You",
        content: "Thanks! Glad you liked it 😊",
        timestamp: Date.now() - 1000 * 60 * 14,
        status: "sent"
      },
      {
        id: "seed-3",
        conversationId: "1",
        sender: "Jazz Fusion",
        content: "The jazz fusion elements are incredible. Have you thought about collaborating with other artists?",
        timestamp: Date.now() - 1000 * 60 * 13,
        status: "sent"
      },
      {
        id: "seed-4",
        conversationId: "1",
        sender: "You",
        content: "Definitely! I'm always open to collaborations. What kind of style are you thinking?",
        timestamp: Date.now() - 1000 * 60 * 12,
        status: "sent"
      },
      {
        id: "seed-5",
        conversationId: "1",
        sender: "Jazz Fusion",
        content: "Maybe something with electronic beats mixed with live instrumentation. I have some ideas for a track called 'Digital Dreams'",
        timestamp: Date.now() - 1000 * 60 * 11,
        status: "sent"
      },
      {
        id: "seed-6",
        conversationId: "1",
        sender: "Jazz Fusion",
        content: "Would love to hear your thoughts on this 🔥",
        timestamp: Date.now() - 1000 * 60 * 10,
        status: "sent"
      }
    ]
  });

  const conversations = [
    {
      id: 1,
      user: "Jazz Fusion",
      avatar: "JF",
      lastMessage: "Hey, loved your latest track! 🔥",
      time: "2m ago",
      unread: true,
      online: true
    },
    {
      id: 2,
      user: "Beat Masters",
      avatar: "BM",
      lastMessage: "Thanks for the collaboration offer",
      time: "1h ago",
      unread: false,
      online: true
    },
    {
      id: 3,
      user: "Synthwave Collective",
      avatar: "SC",
      lastMessage: "When's the next release?",
      time: "3h ago",
      unread: true,
      online: false
    },
    {
      id: 4,
      user: "Ambient Sounds",
      avatar: "AS",
      lastMessage: "Check out this new remix",
      time: "1d ago",
      unread: false,
      online: false
    },
    {
      id: 5,
      user: "Urban Beats",
      avatar: "UB",
      lastMessage: "Great show last night!",
      time: "2d ago",
      unread: false,
      online: true
    }
  ];

  useEffect(() => {
    void realtimeChatService.initialize();
    conversations.forEach((conversation) => {
      realtimeChatService.bootstrapConversation(
        conversation.id.toString(),
        messagesByConversation[conversation.id] ?? []
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    const conversationId = selectedConversation.toString();

    const handleMessage = (message: LiveChatMessage) => {
      setMessagesByConversation((prev) => {
        const existing = prev[selectedConversation] ?? [];
        const updated = [...existing];
        const index = updated.findIndex(
          (item) => item.id === message.id || (item.tempId && item.tempId === message.tempId)
        );

        if (index >= 0) {
          updated[index] = { ...updated[index], ...message };
        } else {
          updated.push(message);
        }

        updated.sort((a, b) => a.timestamp - b.timestamp);

        return {
          ...prev,
          [selectedConversation]: updated
        };
      });

      const stats = realtimeChatService.getLatencyStats();
      if (stats) {
        setLatencyStats(stats);
      }
    };

    const unsubscribe = realtimeChatService.subscribe(conversationId, handleMessage);
    return () => {
      unsubscribe();
    };
  }, [selectedConversation]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const conversationId = selectedConversation.toString();
    await realtimeChatService.sendMessage(conversationId, "You", messageText.trim());
    setMessageText("");
  };

  const selectedUser = conversations.find((conv) => conv.id === selectedConversation);

  const conversationMessages = useMemo(
    () => (selectedConversation ? messagesByConversation[selectedConversation] ?? [] : []),
    [messagesByConversation, selectedConversation]
  );

  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Main Content */}
      <main className="pt-16">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold">Messages</h1>
              {latencyStats ? (
                <Badge variant="outline" className="text-xs">
                  Live · {latencyStats.latest}ms
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Live
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="hidden sm:block">Low latency delivery with WebSocket + BroadcastChannel</span>
              <NotificationDropdown />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
            {/* Conversations Sidebar */}
            <div className="lg:col-span-1">
              <Card className="h-full border-border/50">
                <CardContent className="p-0">
                  {/* Search */}
                  <div className="p-4 border-b border-border/20">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input placeholder="Search messages..." className="pl-10" />
                    </div>
                  </div>

                  {/* Conversations List */}
                  <ScrollArea className="h-full">
                    <div className="divide-y divide-border/20">
                      {conversations.map((conversation) => {
                        const latestMessage = (messagesByConversation[conversation.id] ?? []).at(-1);
                        const preview = latestMessage?.content ?? conversation.lastMessage;
                        const previewTime = latestMessage
                          ? formatTimestamp(latestMessage.timestamp)
                          : conversation.time;

                        return (
                          <div
                            key={conversation.id}
                            onClick={() => setSelectedConversation(conversation.id)}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedConversation === conversation.id ? "bg-primary/10 border-r-2 border-primary" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="w-10 h-10">
                                  <AvatarImage src="" />
                                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                    {conversation.avatar}
                                  </AvatarFallback>
                                </Avatar>
                                {conversation.online && (
                                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h3 className="font-semibold text-sm truncate">{conversation.user}</h3>
                                  <span className="text-xs text-muted-foreground">{previewTime}</span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{preview}</p>
                              </div>

                              {conversation.unread && (
                                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-2">
              <Card className="h-full border-border/50">
                <CardContent className="p-0 h-full">
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {selectedUser?.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-semibold">{selectedUser?.user}</h2>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Live sync
                          </span>
                          {latencyStats && <span>Avg {latencyStats.average}ms</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Video className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="h-[calc(100%-8rem)]">
                    <div className="p-4 space-y-4">
                      {conversationMessages.map((message) => {
                        const isMe = message.sender === "You";
                        return (
                          <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs opacity-80">{message.sender}</span>
                                {message.status === "pending" && (
                                  <Badge variant="secondary" className="text-[10px] h-5 px-2">
                                    sending…
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <span className="text-[10px] opacity-70 block mt-2">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* Composer */}
                  <div className="p-4 border-t border-border/20 bg-background/50">
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Real-time connected
                      </span>
                      {latencyStats && <span>Latest round trip {latencyStats.latest}ms</span>}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon">
                          <Image className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Smile className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Music className="w-4 h-4" />
                        </Button>
                      </div>

                      <Textarea
                        placeholder="Type your message..."
                        className="flex-1 min-h-[60px]"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                      />

                      <div className="flex flex-col gap-2">
                        <Button onClick={sendMessage} className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Send
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2">
                          <Headphones className="w-4 h-4" />
                          Listen
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
