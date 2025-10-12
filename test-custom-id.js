// test-custom-id.js
const mongoose = require('mongoose');
const User = require('./models/User');

const testCustomId = async () => {
  try {
    console.log('🔄 Testing Custom ID Generation...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/event-ticket-db');
    console.log('✅ Connected to MongoDB');
    
    // Test generate custom ID for different roles
    const adminId = await User.generateCustomId('admin');
    const organizerId = await User.generateCustomId('organizer');
    const userId = await User.generateCustomId('user');
    
    console.log('📋 Generated Custom IDs:');
    console.log('Admin ID:', adminId);
    console.log('Organizer ID:', organizerId);
    console.log('User ID:', userId);
    
    // Test creating users with custom IDs
    console.log('\n🔄 Creating test users...');
    
    const adminUser = new User({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: '123456',
      role: 'admin'
    });
    
    const organizerUser = new User({
      name: 'Test Organizer',
      email: 'organizer@test.com',
      password: '123456',
      role: 'organizer'
    });
    
    await adminUser.save();
    await organizerUser.save();
    
    console.log('✅ Test users created successfully!');
    console.log('Admin User:', {
      _id: adminUser._id,
      customId: adminUser.customId,
      name: adminUser.name,
      role: adminUser.role
    });
    console.log('Organizer User:', {
      _id: organizerUser._id,
      customId: organizerUser.customId,
      name: organizerUser.name,
      role: organizerUser.role
    });
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testCustomId();
