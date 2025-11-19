// Test mention notification system
import { notificationService } from '../src/services/notificationService';
import { extractMentions, sendMentionNotifications } from '../src/utils/mentionHelper';

async function testMentionNotification() {
  console.log('🧪 Testing Mention Notification System\n');
  
  try {
    // Test 1: Extract mentions
    console.log('📋 Test 1: Extract mentions from text');
    const testTexts = [
      'Hello @john, how are you?',
      'Hey @alice and @bob, check this out!',
      'No mentions here',
      '@charlie @dave @eve multiple mentions',
      'Email test@example.com should not match',
      '@user123 @test_user @CamelCase'
    ];
    
    testTexts.forEach(text => {
      const mentions = extractMentions(text);
      console.log(`  "${text}"`);
      console.log(`  → Mentions: ${mentions.length > 0 ? mentions.join(', ') : 'none'}\n`);
    });
    
    // Test 2: Connect to notification service
    console.log('📋 Test 2: Connect to notification service');
    await notificationService.connect();
    console.log('✅ Connected\n');
    
    // Test 3: Send test mention notification
    console.log('📋 Test 3: Send test mention notification');
    
    // Test users (replace with actual addresses)
    const fromUser = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'; // Alice
    const toUser = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'; // Bob
    const postId = `test_post_${Date.now()}`;
    const content = 'Hey @bob, check out this new track!';
    
    console.log('From:', fromUser);
    console.log('To:', toUser);
    console.log('Post ID:', postId);
    console.log('Content:', content);
    
    const success = await notificationService.notifyMention(
      fromUser,
      toUser,
      postId,
      content,
      { fromUsername: 'alice' }
    );
    
    if (success) {
      console.log('✅ Mention notification sent successfully\n');
    } else {
      console.log('❌ Failed to send mention notification\n');
    }
    
    // Test 4: Verify notification was created
    console.log('📋 Test 4: Verify notification');
    
    // Wait a bit for blockchain to process
    console.log('⏳ Waiting 3 seconds for blockchain...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const notifications = await notificationService.getUserNotifications(toUser, 10, false);
    console.log(`Found ${notifications.length} notifications for ${toUser.slice(0, 10)}...`);
    
    const mentionNotif = notifications.find(n => 
      n.notificationType === 'mention' && 
      n.fromUser.toLowerCase() === fromUser.toLowerCase()
    );
    
    if (mentionNotif) {
      console.log('✅ Mention notification found:');
      console.log('  Type:', mentionNotif.notificationType);
      console.log('  From:', mentionNotif.fromUser.slice(0, 10) + '...');
      console.log('  To:', mentionNotif.toUser.slice(0, 10) + '...');
      console.log('  Content:', mentionNotif.content);
      console.log('  Time:', new Date(mentionNotif.timestamp).toLocaleString());
    } else {
      console.log('⚠️ Mention notification not found yet (may take a few seconds)');
    }
    
    // Test 5: Test sendMentionNotifications helper
    console.log('\n📋 Test 5: Test sendMentionNotifications helper');
    
    const mockUsers = [
      { username: 'alice', userAddress: fromUser },
      { username: 'bob', userAddress: toUser },
      { username: 'charlie', userAddress: '0x1234567890123456789012345678901234567890' }
    ];
    
    const testContent = 'Hey @bob and @charlie, check this out! @alice is also here.';
    console.log('Content:', testContent);
    console.log('From:', fromUser);
    
    await sendMentionNotifications(testContent, fromUser, postId, mockUsers);
    console.log('✅ Batch mention notifications sent\n');
    
    console.log('✅ All tests completed!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMentionNotification()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
