import React from 'react';
import { Flex, Text, Widget } from 'expo-widgets';

interface WidgetData {
  booksRead: number;
  goal: number;
  lastBook: string;
}

export default function ReadingWidget({ data }: { data: WidgetData }) {
  const booksRead = data?.booksRead ?? 0;
  const goal = data?.goal ?? 0;
  const lastBook = data?.lastBook ?? 'No books finished yet';
  const progress = goal > 0 ? Math.min(booksRead / goal, 1) : 0;

  return (
    <Widget>
      <Flex
        style={{
          flex: 1,
          padding: 16,
          backgroundColor: '#bc6c25', // Rich Burnt Sienna
          borderRadius: 24,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Flex>
          <Text
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: 4,
            }}
          >
            2026 PROGRESS
          </Text>
          <Flex style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#ffffff' }}>
              {booksRead}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>
              / {goal || '—'}
            </Text>
          </Flex>
        </Flex>

        {/* Progress Bar */}
        <Flex 
          style={{ 
            height: 8, 
            width: '100%', 
            backgroundColor: 'rgba(255,255,255,0.2)', 
            borderRadius: 4,
            marginVertical: 12,
            overflow: 'hidden'
          }}
        >
          <Flex 
            style={{ 
              height: '100%', 
              width: `${progress * 100}%`, 
              backgroundColor: '#ffffff',
              borderRadius: 4 
            }} 
          />
        </Flex>

        <Flex>
          <Text
            style={{
              fontSize: 10,
              fontWeight: 'bold',
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
            }}
          >
            Last Finished:
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: '#ffffff',
            }}
            numberOfLines={1}
          >
            {lastBook}
          </Text>
        </Flex>
      </Flex>
    </Widget>
  );
}
