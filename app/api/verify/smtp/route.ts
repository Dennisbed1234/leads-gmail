import { NextResponse } from 'next/server';
import * as net from 'net';
import * as tls from 'tls';

export async function POST(request: Request) {
  try {
    const { email, mxServer } = await request.json();

    // Connect to SMTP server
    const isExists = await checkSMTPUser(email, mxServer);
    
    return NextResponse.json({ exists: isExists });
  } catch (error) {
    return NextResponse.json(
      { error: 'SMTP verification failed' },
      { status: 500 }
    );
  }
}

function checkSMTPUser(email: string, mxServer: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxServer);
    let stage = 0;
    let heloResponse = '';
    let mailResponse = '';
    
    socket.setTimeout(10000); // 10 second timeout

    socket.on('data', (data) => {
      const response = data.toString();
      
      if (stage === 0 && response.includes('220')) {
        // Send HELO
        socket.write('HELO example.com\r\n');
        stage = 1;
      } 
      else if (stage === 1) {
        // Send MAIL FROM
        const fromEmail = `verify@${mxServer}`;
        socket.write(`MAIL FROM:<${fromEmail}>\r\n`);
        stage = 2;
      }
      else if (stage === 2 && response.includes('250')) {
        // Send RCPT TO
        socket.write(`RCPT TO:<${email}>\r\n`);
        stage = 3;
      }
      else if (stage === 3) {
        // Check if recipient exists
        if (response.includes('250') || response.includes('251')) {
          socket.write('QUIT\r\n');
          socket.destroy();
          resolve(true);
        } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
          socket.write('QUIT\r\n');
          socket.destroy();
          resolve(false);
        } else {
          socket.write('QUIT\r\n');
          socket.destroy();
          resolve(false);
        }
      }
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}