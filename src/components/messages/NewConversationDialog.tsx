/**
 * New Conversation Dialog
 */

import { useState } from 'react'
import { SDK } from '@somnia-chain/streams'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAddress } from 'viem'
import { useRegisteredUsers } from '@/hooks/useRegisteredUsers'
import { Search, User } from 'lucide-react'

interface NewConversationDialogProps {
  sdk: SDK | null
  currentUserAddress: string
  type: 'direct' | 'groups'
  onClose: () => void
  onCreateConversation: (address: string, name: string, avatarHash?: string) => void
}

export default function NewConversationDialog({
  sdk,
  currentUserAddress,
  type,
  onClose,
  onCreateConversation
}: NewConversationDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { users, loading: loadingUsers } = useRegisteredUsers(sdk)

  const filteredUsers = users.filter(user => 
    user.address.toLowerCase() !== currentUserAddress.toLowerCase() &&
    (user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.address.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleSelectUser = (address: string, name: string, avatarHash?: string) => {
    console.log('👤 [NEW CONVERSATION] User selected')
    console.log('   Address:', address)
    console.log('   Name:', name)
    console.log('   Calling onCreateConversation...')
    onCreateConversation(address, name, avatarHash)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (type === 'groups') {
      if (!groupName.trim()) {
        setError('Group name is required')
        return
      }

      // TODO: Create group
      console.log('Creating group:', groupName)
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      {type === 'direct' ? (
        <>
          {/* Search Users */}
          <div>
            <Label htmlFor="search" className="text-foreground">Search Users</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by username or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
              />
            </div>
          </div>

          {/* User List */}
          <div className="max-h-96 overflow-y-auto space-y-2 scrollbar-custom">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? 'No users found' : 'No registered users'}
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.address}
                  onClick={() => handleSelectUser(user.address, user.displayName, user.avatarHash)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 rounded-lg transition-colors text-left"
                >
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.address}`}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full ring-2 ring-primary/20"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {user.displayName}
                      </p>
                      {user.isArtist && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          Artist
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="groupName" className="text-foreground">Group Name</Label>
            <Input
              id="groupName"
              placeholder="My Group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="border-border/20 text-foreground hover:bg-muted/30">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
