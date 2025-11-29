/**
 * Encryption Setup Component
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, Key, Lock, CheckCircle } from 'lucide-react'
import { initializeUserEncryption } from '@/services/encryptedMessagingService'

interface EncryptionSetupProps {
  userAddress: string
}

export default function EncryptionSetup({ userAddress }: EncryptionSetupProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  const handleInitialize = async () => {
    setLoading(true)
    try {
      const keys = await initializeUserEncryption(userAddress as `0x${string}`)
      setPublicKey(keys.publicKey)
      setStep(2)
    } catch (error) {
      console.error('Failed to initialize encryption:', error)
      alert('Failed to initialize encryption. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    window.location.reload()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0A0A0A] via-purple-900/20 to-[#0A0A0A] p-4">
      <div className="max-w-md w-full bg-[#111111] border border-gray-800 rounded-2xl shadow-2xl shadow-purple-500/10 p-8">
        {step === 1 ? (
          <>
            {/* Step 1: Introduction */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/50">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-white">
                Enable End-to-End Encryption
              </h1>
              <p className="text-gray-400">
                Secure your messages with military-grade encryption
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Private & Secure</h3>
                  <p className="text-sm text-gray-400">
                    Only you and the recipient can read messages
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Key className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Your Keys, Your Control</h3>
                  <p className="text-sm text-gray-400">
                    Keys are stored securely on your device
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Forward Secrecy</h3>
                  <p className="text-sm text-gray-400">
                    Past messages stay secure even if keys are compromised
                  </p>
                </div>
              </div>
            </div>

            {/* Action */}
            <Button
              onClick={handleInitialize}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg shadow-purple-500/50"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Initializing...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Enable Encryption
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center mt-4">
              This will generate encryption keys on your device
            </p>
          </>
        ) : (
          <>
            {/* Step 2: Success */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/50 animate-pulse">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-white">
                Encryption Enabled!
              </h1>
              <p className="text-gray-400">
                Your messages are now end-to-end encrypted
              </p>
            </div>

            {/* Public Key */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold mb-2 text-white">Your Public Key</h3>
              <div className="bg-[#0A0A0A] border border-gray-700 rounded p-3">
                <code className="text-xs text-gray-400 break-all">
                  {publicKey?.substring(0, 60)}...
                </code>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Share this with others so they can send you encrypted messages
              </p>
            </div>

            {/* Important Note */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-yellow-400 mb-1">
                Important: Backup Your Keys
              </h3>
              <p className="text-xs text-yellow-500/80">
                Make sure to backup your encryption keys. If you lose them, you won't be able to decrypt your messages.
              </p>
            </div>

            {/* Action */}
            <Button
              onClick={handleComplete}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg shadow-purple-500/50"
              size="lg"
            >
              Start Messaging
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
