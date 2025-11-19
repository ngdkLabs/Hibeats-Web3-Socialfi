// Helper untuk mendeteksi dan mengirim notifikasi mention
import { notificationService } from '@/services/notificationService';

/**
 * Extract usernames yang di-mention dari text
 * @param text - Text yang mengandung mention (e.g., "Hello @john and @jane!")
 * @returns Array of usernames (e.g., ["john", "jane"])
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  
  // Regex untuk match @username (alphanumeric + underscore)
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const username = match[1];
    if (username && !mentions.includes(username)) {
      mentions.push(username);
    }
  }
  
  return mentions;
}

/**
 * Kirim notifikasi mention ke semua user yang di-mention
 * @param content - Text content yang mengandung mention
 * @param fromUserAddress - Address user yang membuat mention
 * @param postId - ID post/comment
 * @param allUsers - Array semua user profiles untuk mapping username -> address
 */
export async function sendMentionNotifications(
  content: string,
  fromUserAddress: string,
  postId: string,
  allUsers: Array<{ username: string; userAddress: string }>
): Promise<void> {
  try {
    // Extract mentions dari content
    const mentionedUsernames = extractMentions(content);
    
    if (mentionedUsernames.length === 0) {
      console.log('📭 [MENTION] No mentions found in content');
      return;
    }
    
    console.log('🔔 [MENTION] Found mentions:', mentionedUsernames);
    
    // Map username ke address
    const mentionedUsers = mentionedUsernames
      .map(username => {
        const user = allUsers.find(u => 
          u.username.toLowerCase() === username.toLowerCase()
        );
        return user ? { username, address: user.userAddress } : null;
      })
      .filter(Boolean) as Array<{ username: string; address: string }>;
    
    if (mentionedUsers.length === 0) {
      console.log('⚠️ [MENTION] No valid users found for mentions');
      return;
    }
    
    console.log('📤 [MENTION] Sending notifications to:', mentionedUsers.map(u => u.username));
    
    // Kirim notifikasi ke setiap user yang di-mention
    const notificationPromises = mentionedUsers.map(async ({ username, address }) => {
      // Skip jika mention diri sendiri
      if (address.toLowerCase() === fromUserAddress.toLowerCase()) {
        console.log(`⏭️ [MENTION] Skipping self-mention: @${username}`);
        return;
      }
      
      try {
        await notificationService.notifyMention(
          fromUserAddress,
          address,
          postId,
          content,
          { fromUsername: username }
        );
        console.log(`✅ [MENTION] Notification sent to @${username}`);
      } catch (error) {
        console.error(`❌ [MENTION] Failed to notify @${username}:`, error);
      }
    });
    
    await Promise.all(notificationPromises);
    console.log('✅ [MENTION] All mention notifications sent');
    
  } catch (error) {
    console.error('❌ [MENTION] Failed to send mention notifications:', error);
  }
}
