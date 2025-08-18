const testEventUpdate = async () => {
  try {
    // Test with a known event ID (you'll need to replace this with a real ID from your database)
    const eventId = 'clx1234567890'; // Replace with actual event ID
    
    console.log('🔍 Testing update for event:', eventId);
    
    // Test the update
    const updateData = {
      title: 'Test Event (UPDATED)',
      description: 'This is a test event updated at ' + new Date().toISOString(),
      startsAt: '2024-12-25T10:00',
      endsAt: '2024-12-25T18:00',
      city: 'Test City',
      venue: 'Test Venue',
      eventTypes: ['WORKSHOP']
    };
    
    console.log('📤 Sending update data:', updateData);
    
    const updateResponse = await fetch(`http://localhost:3002/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    console.log('📥 Response status:', updateResponse.status);
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.log('❌ Error response:', errorText);
      return;
    }
    
    const updatedEvent = await updateResponse.json();
    console.log('✅ Update successful:', updatedEvent);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testEventUpdate(); 