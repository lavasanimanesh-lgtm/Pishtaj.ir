import os

def find_anywhere():
    print("Scanning entire system for uploads...")
    exclude_dirs = ['/proc', '/sys', '/dev', '/usr', '/lib', '/var/lib', '/var/cache', '/lib64']
    found = []
    for root, dirs, files in os.walk('/'):
        # Skip excluded dirs
        if any(root.startswith(ed) for ed in exclude_dirs):
            continue
        for file in files:
            if any(k in file for k in ['پایپینگ', 'منشی', 'پذیرش', 'کارشناس', 'لجستیک']):
                found.append(os.path.join(root, file))
                
    if found:
        print("Found files:")
        for f in found:
            print(f)
    else:
        print("No files found anywhere on the system.")

if __name__ == '__main__':
    find_anywhere()
