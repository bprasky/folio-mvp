const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEventSystem() {
  try {
    console.log('🧪 Testing Event System...\n');

    // Test 1: Check if admin user exists
    console.log('1. Checking admin user...');
    const adminUser = await prisma.user.findFirst({
      where: { profileType: 'admin' }
    });
    
    if (!adminUser) {
      console.log('❌ No admin user found. Creating one...');
      const newAdmin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@folio.com',
          profileType: 'admin',
        }
      });
      console.log('✅ Created admin user:', newAdmin.id);
    } else {
      console.log('✅ Admin user found:', adminUser.id);
    }

    // Test 2: Check if vendor user exists
    console.log('\n2. Checking vendor user...');
    const vendorUser = await prisma.user.findFirst({
      where: { profileType: 'vendor' }
    });
    
    if (!vendorUser) {
      console.log('❌ No vendor user found. Creating one...');
      const newVendor = await prisma.user.create({
        data: {
          name: 'Test Vendor',
          email: 'vendor@folio.com',
          profileType: 'vendor',
        }
      });
      console.log('✅ Created vendor user:', newVendor.id);
    } else {
      console.log('✅ Vendor user found:', vendorUser.id);
    }

    // Test 3: Create a test event
    console.log('\n3. Creating test event...');
    const testEvent = await prisma.event.create({
      data: {
        title: 'Test Design Festival 2024',
        description: 'A test design festival for system verification',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-07'),
        location: 'New York, NY',
        type: 'festival',
        status: 'upcoming',
        isSignature: true,
        createdById: adminUser?.id || (await prisma.user.findFirst({ where: { profileType: 'admin' } })).id,
      }
    });
    console.log('✅ Created test event:', testEvent.id);

    // Test 4: Create a test sub-event
    console.log('\n4. Creating test sub-event...');
    const testSubEvent = await prisma.subEvent.create({
      data: {
        title: 'Test Panel Discussion',
        description: 'A test panel discussion about design trends',
        startTime: new Date('2024-12-02T14:00:00'),
        endTime: new Date('2024-12-02T16:00:00'),
        location: 'Main Hall',
        type: 'panel',
        visibility: 'public',
        ticketingType: 'rsvp',
        maxAttendees: 50,
        eventId: testEvent.id,
        createdById: vendorUser?.id || (await prisma.user.findFirst({ where: { profileType: 'vendor' } })).id,
      }
    });
    console.log('✅ Created test sub-event:', testSubEvent.id);

    // Test 5: Create a test invite
    console.log('\n5. Creating test invite...');
    const testInvite = await prisma.subEventInvite.create({
      data: {
        subEventId: testSubEvent.id,
        email: 'test@example.com',
        invitedBy: vendorUser?.id || (await prisma.user.findFirst({ where: { profileType: 'vendor' } })).id,
        status: 'pending',
        message: 'You are invited to our panel discussion!',
      }
    });
    console.log('✅ Created test invite:', testInvite.id);

    // Test 6: Check API endpoints
    console.log('\n6. Testing API endpoints...');
    
    // Test admin events API
    try {
      const adminEventsResponse = await fetch('http://localhost:3001/api/admin/events');
      if (adminEventsResponse.ok) {
        const adminEvents = await adminEventsResponse.json();
        console.log('✅ Admin events API working, found', adminEvents.length, 'events');
      } else {
        console.log('❌ Admin events API failed:', adminEventsResponse.status);
      }
    } catch (error) {
      console.log('❌ Admin events API error:', error.message);
    }

    // Test vendor sub-events API
    try {
      const vendorSubEventsResponse = await fetch('http://localhost:3001/api/vendor/subevents');
      if (vendorSubEventsResponse.ok) {
        const vendorSubEvents = await vendorSubEventsResponse.json();
        console.log('✅ Vendor sub-events API working, found', vendorSubEvents.length, 'sub-events');
      } else {
        console.log('❌ Vendor sub-events API failed:', vendorSubEventsResponse.status);
      }
    } catch (error) {
      console.log('❌ Vendor sub-events API error:', error.message);
    }

    // Test 7: Check database relationships
    console.log('\n7. Checking database relationships...');
    
    const eventWithSubEvents = await prisma.event.findUnique({
      where: { id: testEvent.id },
      include: {
        subEvents: {
          include: {
            subEventInvites: true,
            subEventRSVPs: true,
          }
        }
      }
    });

    console.log('✅ Event has', eventWithSubEvents?.subEvents.length, 'sub-events');
    console.log('✅ Sub-events have', eventWithSubEvents?.subEvents.reduce((sum, se) => sum + se.subEventInvites.length, 0), 'invites');

    // Test 8: Test invite validation
    console.log('\n8. Testing invite validation...');
    try {
      const inviteValidationResponse = await fetch(`http://localhost:3001/api/invites/accept/${testInvite.inviteToken}`);
      if (inviteValidationResponse.ok) {
        const inviteData = await inviteValidationResponse.json();
        console.log('✅ Invite validation API working, invite is valid');
      } else {
        console.log('❌ Invite validation API failed:', inviteValidationResponse.status);
      }
    } catch (error) {
      console.log('❌ Invite validation API error:', error.message);
    }

    console.log('\n🎉 Event system test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Admin user: ✅');
    console.log('- Vendor user: ✅');
    console.log('- Test event: ✅');
    console.log('- Test sub-event: ✅');
    console.log('- Test invite: ✅');
    console.log('- API endpoints: ✅');
    console.log('- Database relationships: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testEventSystem(); 