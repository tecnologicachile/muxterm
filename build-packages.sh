#!/bin/bash

# Build DEB and RPM packages for MuxTerm

VERSION="1.0.0"
ARCH="amd64"
NAME="muxterm"
DESC="Web-based Terminal Multiplexer"

# Create package structure
mkdir -p pkg/{DEBIAN,usr/lib/muxterm,usr/bin,etc/systemd/system,usr/share/doc/muxterm}

# Copy files
cp -r server client package*.json pkg/usr/lib/muxterm/
cp LICENSE README.md pkg/usr/share/doc/muxterm/
cp update.sh pkg/usr/lib/muxterm/

# Create wrapper script
cat > pkg/usr/bin/muxterm << 'EOF'
#!/bin/bash
cd /usr/lib/muxterm
exec node server/index.js "$@"
EOF
chmod +x pkg/usr/bin/muxterm

# Create systemd service
cat > pkg/etc/systemd/system/muxterm.service << EOF
[Unit]
Description=MuxTerm - Web-based Terminal Multiplexer
After=network.target

[Service]
Type=simple
User=muxterm
WorkingDirectory=/usr/lib/muxterm
ExecStart=/usr/bin/node /usr/lib/muxterm/server/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create DEB control file
cat > pkg/DEBIAN/control << EOF
Package: $NAME
Version: $VERSION
Section: web
Priority: optional
Architecture: $ARCH
Depends: nodejs (>= 16.0.0), tmux
Maintainer: MuxTerm Contributors <muxterm@tecnologicachile.com>
Description: $DESC
 MuxTerm is a web-based terminal multiplexer that provides
 persistent SSH sessions with tmux-like features.
EOF

# Create postinst script
cat > pkg/DEBIAN/postinst << 'EOF'
#!/bin/bash
set -e

# Create user
if ! id -u muxterm >/dev/null 2>&1; then
    useradd -r -s /bin/false -d /var/lib/muxterm -m muxterm
fi

# Create directories
mkdir -p /var/lib/muxterm/{data,logs,sessions}
chown -R muxterm:muxterm /var/lib/muxterm

# Install dependencies
cd /usr/lib/muxterm
npm ci --only=production
cd client && npm ci --only=production && npm run build

# Generate secret if not exists
if [ ! -f /etc/muxterm.env ]; then
    echo "JWT_SECRET=$(openssl rand -base64 32)" > /etc/muxterm.env
    echo "NODE_ENV=production" >> /etc/muxterm.env
    chmod 600 /etc/muxterm.env
    chown muxterm:muxterm /etc/muxterm.env
fi

# Reload systemd
systemctl daemon-reload

echo "MuxTerm installed successfully!"
echo "Start with: systemctl start muxterm"
echo "Enable on boot: systemctl enable muxterm"
EOF
chmod +x pkg/DEBIAN/postinst

# Build DEB package
dpkg-deb --build pkg muxterm_${VERSION}_${ARCH}.deb

# Create RPM spec file
cat > muxterm.spec << EOF
Name:           muxterm
Version:        $VERSION
Release:        1%{?dist}
Summary:        $DESC
License:        MIT
URL:            https://github.com/tecnologicachile/muxterm
Source0:        %{name}-%{version}.tar.gz
BuildArch:      noarch
Requires:       nodejs >= 16.0.0, tmux

%description
MuxTerm is a web-based terminal multiplexer that provides
persistent SSH sessions with tmux-like features.

%prep
%setup -q

%install
mkdir -p %{buildroot}/usr/lib/muxterm
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/etc/systemd/system
mkdir -p %{buildroot}/usr/share/doc/muxterm

cp -r * %{buildroot}/usr/lib/muxterm/
cp muxterm.service %{buildroot}/etc/systemd/system/

cat > %{buildroot}/usr/bin/muxterm << 'EOFF'
#!/bin/bash
cd /usr/lib/muxterm
exec node server/index.js "\$@"
EOFF
chmod +x %{buildroot}/usr/bin/muxterm

%files
/usr/lib/muxterm
/usr/bin/muxterm
/etc/systemd/system/muxterm.service
/usr/share/doc/muxterm

%post
useradd -r -s /bin/false -d /var/lib/muxterm -m muxterm || true
mkdir -p /var/lib/muxterm/{data,logs,sessions}
chown -R muxterm:muxterm /var/lib/muxterm
systemctl daemon-reload

%changelog
* $(date +"%a %b %d %Y") MuxTerm Contributors <muxterm@tecnologicachile.com> - $VERSION-1
- Initial release
EOF

echo "Packages built:"
echo "  DEB: muxterm_${VERSION}_${ARCH}.deb"
echo "  RPM: Build with: rpmbuild -ba muxterm.spec"