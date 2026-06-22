#!/bin/bash
cd "$(dirname "$0")"
echo "========================================"
echo "  Local Work Hub"
echo "========================================"
echo ""
echo "Starting development server..."
echo "Access: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo "========================================"
npm run db:push && npm run dev
