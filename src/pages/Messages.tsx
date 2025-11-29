/**
 * Messages Page V2 - Simplified Messaging System
 * No encryption - Fast & reliable like Twitter DM
 */

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { SDK } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { somniaTestnet } from '@/lib/web3-config'
import Navbar from '@/components/Navbar'
import ConversationList from '@/components/messages/ConversationList'
import ChatWindow from '@/components/messages/ChatWindow'
import { MessageSquare } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

export default function Messages() {
  const { address, isConnected, connector } = useAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sdk, setSdk] = useState<SDK | null>(null)
  const [publicClient, setPublicClient] = useState<any>(null)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null)
  const [conversationListKey, setConversationListKey] = useState(0) // Force reload conversation list

  // No encryption setup needed in V2!

  // Auto-select conversation from URL params
  useEffect(() => {
    const conversationParam = searchParams.get('conversation')
    const recipientParam = searchParams.get('recipient')
    
    if (conversationParam && recipientParam) {
      console.log('🔗 [MESSAGES] Auto-selecting conversation from URL')
      console.log('   Conversation:', conversationParam)
      console.log('   Recipient:', recipientParam)
      
      setSelectedConversation(conversationParam)
      setSelectedRecipient(recipientParam)
      
      // Clear params after setting state
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  // Maintain selected conversation after list reload
  // This prevents ChatWindow from closing when conversation list refreshes
  useEffect(() => {
    if (selectedConversation && selectedRecipient) {
      console.log('🔒 [MESSAGES] Maintaining selected conversation after reload')
      console.log('   Conversation:', selectedConversation)
      console.log('   Recipient:', selectedRecipient)
    }
  }, [conversationListKey, selectedConversation, selectedRecipient])

  // Debug: Track state changes
  useEffect(() => {
    console.log('🔄 [MESSAGES PAGE] State changed')
    console.log('   selectedConversation:', selectedConversation)
    console.log('   selectedRecipient:', selectedRecipient)
  }, [selectedConversation, selectedRecipient])

  // Initialize SDK
  useEffect(() => {
    if (!isConnected || !address || !connector) {
      console.log('⏸️ [MESSAGES] Waiting for wallet connection...')
      console.log('   isConnected:', isConnected)
      console.log('   address:', address)
      console.log('   connector:', connector)
      return
    }

    const initSDK = async () => {
      try {
        console.log('🔧 [MESSAGES] Initializing SDK...')
        console.log('   Connected address:', address)
        console.log('   Connector:', connector.name)
        
        // Use RPC URL from config
        const rpcUrl = somniaTestnet.rpcUrls.default.http[0]
        console.log('   RPC URL:', rpcUrl)
        
        // @ts-ignore - viem type issue with account
        const pubClient = createPublicClient({
          chain: somniaTestnet,
          transport: http(rpcUrl)
        }) as any

        // Get wallet client from connector
        let walletClient: any
        try {
          console.log('   Getting provider from connector...')
          const provider = await connector.getProvider() as any
          
          if (provider) {
            console.log('   Creating wallet client with provider...')
            // @ts-ignore - viem type mismatch
            walletClient = createWalletClient({
              account: address,
              chain: somniaTestnet,
              transport: custom(provider as any)
            }) as any
            console.log('   ✅ Wallet client created with connector')
          } else {
            console.warn('   ⚠️ No provider from connector, trying window.ethereum...')
            if ((window as any).ethereum) {
              // @ts-ignore - viem type mismatch
              walletClient = createWalletClient({
                account: address,
                chain: somniaTestnet,
                transport: custom((window as any).ethereum as any)
              }) as any
              console.log('   ✅ Wallet client created with window.ethereum')
            }
          }
        } catch (error) {
          console.error('   ❌ Error getting provider:', error)
          // Fallback to window.ethereum
          if ((window as any).ethereum) {
            console.log('   Fallback: Using window.ethereum...')
            // @ts-ignore - viem type mismatch
            walletClient = createWalletClient({
              account: address,
              chain: somniaTestnet,
              transport: custom((window as any).ethereum as any)
            }) as any
            console.log('   ✅ Wallet client created (fallback)')
          }
        }

        if (!walletClient) {
          console.error('   ❌ Failed to create wallet client')
          return
        }

        // @ts-ignore - SDK type definition issue
        const sdkInstance = new SDK({
          public: pubClient,
          wallet: walletClient
        })

        // Verify SDK wallet connection
        // @ts-ignore - SDK wallet property
        if (sdkInstance.wallet?.account?.address) {
          // @ts-ignore
          console.log('   ✅ SDK wallet connected:', sdkInstance.wallet.account.address)
        } else {
          console.warn('   ⚠️ SDK wallet not properly connected')
          console.warn('   SDK object:', sdkInstance)
        }

        setPublicClient(pubClient)
        setSdk(sdkInstance)
        
        console.log('✅ [MESSAGES] SDK initialized successfully')
        console.log('   SDK ready for transactions')
      } catch (error) {
        console.error('❌ [MESSAGES] Failed to initialize SDK:', error)
      }
    }

    initSDK()
  }, [isConnected, address, connector])

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">Connect Your Wallet</h2>
          <p className="text-muted-foreground">Please connect your wallet to access messages</p>
        </div>
      </div>
    )
  }

  // No encryption setup needed in V2!

  return (
    <div className="min-h-screen bg-background">
      <Navbar showCreateSongButton={false} />
      
      {/* Main Content */}
      <main className="pt-16">
        <div className="container mx-auto px-6 py-3">
          {/* Header */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h1 className="font-clash font-semibold text-2xl">Messages</h1>
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-medium rounded-full border border-primary/20">Live</span>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex gap-6 h-[calc(100vh-140px)]">
            {/* Sidebar - Conversation List */}
            <div className="w-[340px] bg-card border border-border rounded-xl flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-4 border-b border-border">
                <ConversationList
                  key={conversationListKey}
                  sdk={sdk}
                  currentUserAddress={address!}
                  selectedConversation={selectedConversation}
                  onSelectConversation={(convId, recipientAddr) => {
                    console.log('📱 [MESSAGES PAGE] onSelectConversation called')
                    console.log('   Conversation ID:', convId)
                    console.log('   Recipient:', recipientAddr)
                    setSelectedConversation(convId)
                    setSelectedRecipient(recipientAddr)
                    console.log('   State updated, ChatWindow should render')
                  }}
                  type="direct"
                />
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
              {(() => {
                console.log('🖼️ [MESSAGES PAGE] Rendering chat area')
                console.log('   selectedConversation:', selectedConversation)
                console.log('   selectedRecipient:', selectedRecipient)
                console.log('   Should show ChatWindow:', !!(selectedConversation && selectedRecipient))
                
                return selectedConversation && selectedRecipient ? (
                  <ChatWindow
                    sdk={sdk}
                    publicClient={publicClient}
                    conversationId={selectedConversation}
                    recipientAddress={selectedRecipient as `0x${string}`}
                    currentUserAddress={address!}
                    type="direct"
                    onMessageSent={() => {
                      console.log('📬 [MESSAGES PAGE] Message sent, reloading conversation list...')
                      setConversationListKey(prev => prev + 1)
                      
                      // Keep the conversation selected after sending message
                      // This ensures ChatWindow stays open even after conversation list reloads
                      console.log('🔒 [MESSAGES PAGE] Keeping conversation selected:', selectedConversation)
                    }}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="w-12 h-12 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">
                        Select a conversation
                      </h2>
                      <p className="text-muted-foreground">
                        Choose a conversation from the list to start messaging
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
