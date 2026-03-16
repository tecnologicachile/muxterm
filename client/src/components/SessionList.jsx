import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Box
} from '@mui/material';
import {
  Add as AddIcon,
  Logout as LogoutIcon,
  Terminal as TerminalIcon,
  Delete as DeleteIcon,
  ViewModule as GridIcon,
  SplitscreenOutlined as SplitIcon,
  DeleteSweep as DeleteAllIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useAuth } from '../utils/AuthContext';
import { useSocket } from '../utils/SocketContext';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import VersionIndicator from './VersionIndicator';
import AppHeader from './AppHeader';

function SessionList() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [sessions, setSessions] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [sessionType, setSessionType] = useState('local'); // 'local' or 'ssh'
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [sshConnections, setSshConnections] = useState([]);
  const [selectedSshConnection, setSelectedSshConnection] = useState('');

  useEffect(() => {
    if (socket) {
      socket.on('sessions', (userSessions) => {
        setSessions(userSessions);
      });
      socket.on('ssh-connections', (conns) => {
        setSshConnections(conns);
      });

      socket.emit('get-sessions');
      socket.emit('get-ssh-connections');

      return () => {
        socket.off('sessions');
        socket.off('ssh-connections');
      };
    }
  }, [socket]);

  const handleCreateSession = () => {
    if (socket) {
      let name = sessionName;

      // If SSH, save connection first if it's new
      if (sessionType === 'ssh' && !selectedSshConnection && sshHost) {
        const connName = name || `${sshUsername}@${sshHost}`;
        socket.emit('create-ssh-connection', {
          name: connName,
          host: sshHost,
          port: parseInt(sshPort) || 22,
          username: sshUsername,
          authType: 'password',
          password: sshPassword
        });
      }

      if (!name) {
        if (sessionType === 'ssh') {
          name = sshHost ? `${sshUsername}@${sshHost}` : 'SSH Session';
        } else {
          name = `Session ${new Date().toLocaleDateString()}`;
        }
      }

      const createData = { name };
      if (sessionType === 'ssh') {
        if (selectedSshConnection) {
          createData.sshConnectionId = parseInt(selectedSshConnection);
        } else if (sshHost) {
          // Pass SSH config directly for immediate use
          createData.sshConfig = {
            host: sshHost,
            port: parseInt(sshPort) || 22,
            username: sshUsername,
            password: sshPassword
          };
        }
      }

      socket.emit('create-session', createData);
      
      socket.once('session-created', (data) => {
        setCreateDialogOpen(false);
        setSessionName('');
        setSessionType('local');
        setSshHost(''); setSshPort('22'); setSshUsername(''); setSshPassword('');
        setSelectedSshConnection('');
        const sshParam = data.sshConnectionId ? `?ssh=${data.sshConnectionId}` : '';
        navigate(`/terminal/${data.sessionId}${sshParam}`);
      });
      
      socket.once('session-error', (error) => {
        logger.error('Session creation error:', error);
        alert('Failed to create session: ' + error.message);
      });
    } else {
      logger.error('Socket not connected!');
      alert('Socket not connected. Please refresh the page.');
    }
  };

  const handleOpenSession = (sessionId) => {
    navigate(`/terminal/${sessionId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const handleDeleteSession = (session) => {
    setSessionToDelete(session);
    setDeleteConfirmOpen(true);
  };
  
  const confirmDeleteSession = () => {
    if (socket && sessionToDelete) {
      socket.emit('delete-session', { sessionId: sessionToDelete.id });
      setDeleteConfirmOpen(false);
      setSessionToDelete(null);
    }
  };
  
  const handleDeleteAllSessions = () => {
    setDeleteAllConfirmOpen(true);
  };
  
  const confirmDeleteAllSessions = () => {
    if (socket) {
      socket.emit('delete-all-sessions');
      setDeleteAllConfirmOpen(false);
    }
  };
  
  const handleEditSession = (session) => {
    setEditingSession(session);
    setEditedName(session.name);
    setEditDialogOpen(true);
  };
  
  const confirmEditSession = () => {
    if (socket && editingSession) {
      socket.emit('update-session-name', {
        sessionId: editingSession.id,
        name: editedName
      });
      setEditDialogOpen(false);
      setEditingSession(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <AppHeader 
        mode="sessions"
        username={user?.username}
        onLogout={handleLogout}
      />

      <Container maxWidth="lg" className="session-list" sx={{ overflow: 'auto', maxHeight: 'calc(100dvh - 64px)', pb: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Your Sessions</Typography>
          <Box>
            {sessions.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteAllIcon />}
                onClick={handleDeleteAllSessions}
                sx={{ mr: 2 }}
              >
                Delete All
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Session
            </Button>
          </Box>
        </Box>

        {sessions.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body1" align="center" color="text.secondary">
                No active sessions. Create a new session to get started.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {sessions.map((session) => (
              <Grid item xs={12} md={6} lg={4} key={session.id}>
                <Card 
                  className="session-card"
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent onClick={() => handleOpenSession(session.id)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {session.panelCount > 3 ? (
                        <GridIcon sx={{ mr: 1, color: 'primary.main' }} />
                      ) : session.panelCount > 1 ? (
                        <SplitIcon sx={{ mr: 1, color: 'primary.main' }} />
                      ) : (
                        <TerminalIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      )}
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {session.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Layout: <strong>{session.layoutInfo || `${session.terminals || 0} terminal(s)`}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created: {formatDate(session.createdAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last accessed: {formatDate(session.lastAccessed)}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <Button 
                        size="small" 
                        onClick={() => handleOpenSession(session.id)}
                        startIcon={<TerminalIcon />}
                      >
                        Open
                      </Button>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSession(session);
                        }}
                        title="Edit session name"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session);
                        }}
                        color="error"
                        title="Delete session"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <Button
              variant={sessionType === 'local' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setSessionType('local')}
              sx={{ flex: 1 }}
            >
              Local Terminal
            </Button>
            <Button
              variant={sessionType === 'ssh' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setSessionType('ssh')}
              sx={{ flex: 1 }}
            >
              SSH Connection
            </Button>
          </Box>

          <TextField
            autoFocus
            margin="dense"
            label="Session Name (optional)"
            fullWidth
            variant="outlined"
            size="small"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleCreateSession();
            }}
          />

          {sessionType === 'ssh' && (
            <Box sx={{ mt: 2 }}>
              {sshConnections.length > 0 && (
                <TextField
                  select
                  fullWidth
                  size="small"
                  margin="dense"
                  label="Saved Connection"
                  value={selectedSshConnection}
                  onChange={(e) => {
                    setSelectedSshConnection(e.target.value);
                    if (e.target.value) {
                      const conn = sshConnections.find(c => c.id === parseInt(e.target.value));
                      if (conn) {
                        setSshHost(conn.host);
                        setSshPort(conn.port.toString());
                        setSshUsername(conn.username);
                        setSessionName(conn.name);
                      }
                    }
                  }}
                  SelectProps={{ native: true }}
                >
                  <option value="">-- New Connection --</option>
                  {sshConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.username}@{conn.host})
                    </option>
                  ))}
                </TextField>
              )}

              {!selectedSshConnection && (
                <>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      margin="dense"
                      label="Host"
                      variant="outlined"
                      size="small"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      sx={{ flex: 3 }}
                      placeholder="192.168.1.100"
                    />
                    <TextField
                      margin="dense"
                      label="Port"
                      variant="outlined"
                      size="small"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <TextField
                    margin="dense"
                    label="Username"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="root"
                  />
                  <TextField
                    margin="dense"
                    label="Password"
                    type="password"
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                  />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSession}
            variant="contained"
            disabled={sessionType === 'ssh' && !selectedSshConnection && !sshHost}
          >
            {sessionType === 'ssh' ? 'Connect' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the session "{sessionToDelete?.name}"?
            This will close all terminals in this session.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteSession} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete all confirmation dialog */}
      <Dialog
        open={deleteAllConfirmOpen}
        onClose={() => setDeleteAllConfirmOpen(false)}
      >
        <DialogTitle>Delete All Sessions</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete ALL sessions?
            This will close all terminals and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteAllSessions} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit session name dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Session Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Name"
            fullWidth
            variant="outlined"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                confirmEditSession();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmEditSession} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default SessionList;