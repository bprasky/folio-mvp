const testEventUpdate = async () => {
  try {
    // First, let's get a list of events to find one to update
    console.log('🔍 Fetching events...');
    const eventsResponse = await fetch('http://localhost:3002/api/events');
    const events = await eventsResponse.json();
    
    if (!events || events.length === 0) {
      console.log('❌ No events found');
      return;
    }
    
    const testEvent = events[0];
    console.log('📋 Found event:', testEvent.id, testEvent.title);
    
    // Test the update
    const updateData = {
      title: testEvent.title + ' (UPDATED)',
      description: testEvent.description + ' - Updated at ' + new Date().toISOString(),
      startsAt: '2024-12-25T10:00',
      endsAt: '2024-12-25T18:00',
      city: 'Test City',
      venue: 'Test Venue',
      eventTypes: ['WORKSHOP']
    };
    
    console.log('📤 Sending update data:', updateData);
    
    const updateResponse = await fetch(`http://localhost:3002/api/events/${testEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    console.log('📥 Response status:', updateResponse.status);
    console.log('📥 Response headers:', Object.fromEntries(updateResponse.headers.entries()));
    
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