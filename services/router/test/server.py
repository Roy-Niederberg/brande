import os
from http.server import HTTPServer, BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        service_name = os.environ.get('SERVICE_NAME', 'UNKNOWN')
        app_name = os.environ.get('APP_NAME', 'UNKNOWN')
        message = f'Hi, I am {service_name}! This is {app_name}'

        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(message.encode())

    def do_POST(self):
        self.do_GET()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 9876), Handler)
    service_name = os.environ.get('SERVICE_NAME', 'UNKNOWN')
    app_name = os.environ.get('APP_NAME', 'UNKNOWN')
    print(f'Server running on port 9876 - {service_name}::{app_name}')
    server.serve_forever()
