import React, { useState, useEffect } from 'react';
import { Chip, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import axios from 'axios';
import logger from '../utils/logger';

function GitHubStars() {
  const [stars, setStars] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStars = async () => {
    try {
      const response = await axios.get('https://api.github.com/repos/tecnologicachile/muxterm');
      setStars(response.data.stargazers_count);
      logger.debug('GitHub stars fetched:', response.data.stargazers_count);
    } catch (error) {
      logger.error('Failed to fetch GitHub stars:', error);
      // Try using our backend as proxy to avoid rate limits
      try {
        const backendResponse = await axios.get('/api/github-stars');
        if (backendResponse.data.stars !== undefined) {
          setStars(backendResponse.data.stars);
        }
      } catch (backendError) {
        logger.error('Failed to fetch stars from backend:', backendError);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchStars();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchStars, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    window.open('https://github.com/tecnologicachile/muxterm', '_blank', 'noopener,noreferrer');
  };

  if (loading || stars === null) {
    return null;
  }

  return (
    <Tooltip title="Star us on GitHub! 🌟">
      <Chip
        icon={<StarIcon sx={{ fontSize: 16 }} />}
        label={stars.toLocaleString()}
        size="small"
        onClick={handleClick}
        sx={{
          cursor: 'pointer',
          bgcolor: 'rgba(255, 193, 7, 0.1)',
          color: '#ffc107',
          borderColor: '#ffc107',
          border: '1px solid',
          '&:hover': {
            bgcolor: 'rgba(255, 193, 7, 0.2)',
            borderColor: '#ffb300',
            transform: 'scale(1.05)',
          },
          transition: 'all 0.2s ease',
          fontWeight: 'bold',
          ml: 1
        }}
      />
    </Tooltip>
  );
}

export default GitHubStars;