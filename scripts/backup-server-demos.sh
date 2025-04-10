#!/bin/bash

# Script to backup demo files from the server before deployment
# This ensures user-created demos are preserved when deploying new code

set -e  # Exit on any error

# Configuration
SERVER="noyesdemos"
SERVER_DEMOS_PATH="/home/ec2-user/app/.next/standalone/public/demos"
SERVER_MARKDOWN_PATH="/home/ec2-user/app/.next/standalone/public/markdown"
LOCAL_DEMOS_PATH="./public/demos"
LOCAL_MARKDOWN_PATH="./public/markdown"
BACKUP_DIR="./server-backup-$(date +%Y%m%d%H%M%S)"
STATIC_DEMOS=("math-assistant" "writing-assistant" "language-assistant" "coding-assistant")

echo "===== Backing up server demos ====="

# Create temporary backup directory
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup all demos from server
echo "Fetching demos from server..."
rsync -av --exclude=".*" "$SERVER:$SERVER_DEMOS_PATH/" "$BACKUP_DIR/demos/"
rsync -av --exclude=".*" "$SERVER:$SERVER_MARKDOWN_PATH/" "$BACKUP_DIR/markdown/"

# Create destination directories if they don't exist
mkdir -p "$LOCAL_DEMOS_PATH"
mkdir -p "$LOCAL_MARKDOWN_PATH"

# Check what's been backed up
echo "Backed up demos:"
ls -la "$BACKUP_DIR/demos/"

# Process demos - merge with local, respecting deletions
echo "Syncing demos to local repository..."

# Create a list of all dynamic demos on the local filesystem
echo "Checking for deleted demos..."
LOCAL_DYNAMIC_DEMOS=()
if [ -d "$LOCAL_DEMOS_PATH" ]; then
  for demo_dir in "$LOCAL_DEMOS_PATH"/*; do
    if [ -d "$demo_dir" ]; then
      demo_name=$(basename "$demo_dir")
      
      # Only add dynamic demos to the list
      if [[ ! " ${STATIC_DEMOS[@]} " =~ " ${demo_name} " ]]; then
        LOCAL_DYNAMIC_DEMOS+=("$demo_name")
      fi
    fi
  done
fi

# Create a list of all dynamic demos in the backup (server)
SERVER_DYNAMIC_DEMOS=()
for demo_dir in "$BACKUP_DIR/demos"/*; do
  if [ -d "$demo_dir" ]; then
    demo_name=$(basename "$demo_dir")
    
    # Only add dynamic demos to the list
    if [[ ! " ${STATIC_DEMOS[@]} " =~ " ${demo_name} " ]]; then
      SERVER_DYNAMIC_DEMOS+=("$demo_name")
    fi
  fi
done

# Find demos that exist locally but not on server (deleted on server)
for local_demo in "${LOCAL_DYNAMIC_DEMOS[@]}"; do
  found=false
  for server_demo in "${SERVER_DYNAMIC_DEMOS[@]}"; do
    if [ "$local_demo" == "$server_demo" ]; then
      found=true
      break
    fi
  done
  
  if [ "$found" = false ]; then
    echo "Demo '$local_demo' exists locally but not on server - it was deleted"
    echo "Removing deleted demo: $local_demo"
    rm -rf "$LOCAL_DEMOS_PATH/$local_demo"
    
    # Also remove related markdown files
    find "$LOCAL_MARKDOWN_PATH" -name "$local_demo-*.md" -delete
  fi
done

# For each demo in the backup
for demo_dir in "$BACKUP_DIR/demos"/*; do
  if [ -d "$demo_dir" ]; then
    demo_name=$(basename "$demo_dir")
    
    # Skip static demos that shouldn't be overwritten
    if [[ " ${STATIC_DEMOS[@]} " =~ " ${demo_name} " ]]; then
      echo "Skipping static demo: $demo_name"
      continue
    fi
    
    echo "Processing demo: $demo_name"
    
    # If demo exists locally, compare modification times
    if [ -d "$LOCAL_DEMOS_PATH/$demo_name" ]; then
      # Use the newer version (server version in this case)
      echo "Updating existing demo: $demo_name"
      rsync -av --delete "$demo_dir/" "$LOCAL_DEMOS_PATH/$demo_name/"
    else
      # Demo doesn't exist locally, copy it
      echo "Adding new demo: $demo_name"
      cp -r "$demo_dir" "$LOCAL_DEMOS_PATH/"
    fi
  fi
done

# Process markdown files
echo "Syncing markdown files to local repository..."

# Create a list of server markdown files related to dynamic demos
SERVER_MARKDOWN_FILES=()
for md_file in "$BACKUP_DIR/markdown"/*; do
  if [ -f "$md_file" ]; then
    file_name=$(basename "$md_file")
    
    # Skip system files and files for static demos
    if [[ "$file_name" == .* ]]; then
      continue
    fi
    
    is_static=false
    for static_demo in "${STATIC_DEMOS[@]}"; do
      if [[ "$file_name" == "$static_demo"* ]]; then
        is_static=true
        break
      fi
    done
    
    if [ "$is_static" = false ]; then
      SERVER_MARKDOWN_FILES+=("$file_name")
    fi
  fi
done

# Delete local markdown files that don't exist on server (for dynamic demos)
for local_md in "$LOCAL_MARKDOWN_PATH"/*; do
  if [ -f "$local_md" ]; then
    file_name=$(basename "$local_md")
    
    # Skip system files
    if [[ "$file_name" == .* ]]; then
      continue
    fi
    
    # Skip files for static demos
    is_static=false
    for static_demo in "${STATIC_DEMOS[@]}"; do
      if [[ "$file_name" == "$static_demo"* ]]; then
        is_static=true
        break
      fi
    done
    
    if [ "$is_static" = true ]; then
      continue
    fi
    
    # Check if this markdown file exists on server
    found=false
    for server_md in "${SERVER_MARKDOWN_FILES[@]}"; do
      if [ "$file_name" == "$server_md" ]; then
        found=true
        break
      fi
    done
    
    if [ "$found" = false ]; then
      echo "Markdown file '$file_name' exists locally but not on server - it was deleted"
      echo "Removing deleted markdown: $file_name"
      rm -f "$LOCAL_MARKDOWN_PATH/$file_name"
    fi
  fi
done

# Process and copy markdown files from server
for md_file in "$BACKUP_DIR/markdown"/*; do
  if [ -f "$md_file" ]; then
    file_name=$(basename "$md_file")
    
    # Skip any system or temporary files
    if [[ "$file_name" == .* ]]; then
      continue
    fi
    
    # Check if file contains demo ID that we want to preserve
    is_static=false
    for static_demo in "${STATIC_DEMOS[@]}"; do
      if [[ "$file_name" == "$static_demo"* ]]; then
        is_static=true
        break
      fi
    done
    
    if [ "$is_static" = true ]; then
      echo "Skipping static markdown: $file_name"
      continue
    fi
    
    echo "Processing markdown: $file_name"
    cp "$md_file" "$LOCAL_MARKDOWN_PATH/"
  fi
done

echo "Backup and sync completed successfully!"
echo "You can now proceed with deployment."
echo "Backup saved in: $BACKUP_DIR (you can delete this after successful deployment)" 