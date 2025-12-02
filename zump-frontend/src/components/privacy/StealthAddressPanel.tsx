/**
 * StealthAddressPanel Component
 * Displays stealth address generation UI and list of generated addresses
 * Requirements: 10.3
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  Divider,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useStealthAddress } from '../../hooks/useStealthAddress';
import { useWallet } from '../../hooks/useWallet';
import { StealthAddress } from '../../@types/privacy';

interface StealthAddressPanelProps {
  compact?: boolean;
}

export function StealthAddressPanel({ compact = false }: StealthAddressPanelProps) {
  const { isConnected } = useWallet();
  const {
    stealthAddresses,
    isGenerating,
    error,
    generateStealthAddress,
    removeStealthAddress,
  } = useStealthAddress();

  const [expanded, setExpanded] = useState(!compact);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleGenerate = async () => {
    await generateStealthAddress();
  };

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 13) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isConnected) {
    return (
      <Card sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography color="text.secondary" align="center">
            Stealth adres oluşturmak için cüzdanınızı bağlayın
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VisibilityIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6">Stealth Adresler</Typography>
            <Chip
              label={stealthAddresses.length}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          </Box>
        }
        action={
          compact ? (
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : null
        }
        sx={{ pb: 0 }}
      />
      
      <Collapse in={expanded}>
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            startIcon={isGenerating ? <CircularProgress size={20} /> : <AddIcon />}
            onClick={handleGenerate}
            disabled={isGenerating}
            fullWidth
            sx={{ mb: 2 }}
          >
            {isGenerating ? 'Oluşturuluyor...' : 'Yeni Stealth Adres Oluştur'}
          </Button>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Stealth adresler, işlemlerinizi ana cüzdanınızla ilişkilendirilemez hale getirir.
          </Typography>

          {stealthAddresses.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="text.secondary">
                Henüz stealth adres oluşturmadınız
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {stealthAddresses.map((stealth, index) => (
                <React.Fragment key={stealth.address}>
                  <StealthAddressItem
                    stealth={stealth}
                    index={index}
                    onCopy={handleCopy}
                    onRemove={removeStealthAddress}
                    copiedAddress={copiedAddress}
                    formatAddress={formatAddress}
                    formatDate={formatDate}
                  />
                  {index < stealthAddresses.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
}

interface StealthAddressItemProps {
  stealth: StealthAddress;
  index: number;
  onCopy: (address: string) => void;
  onRemove: (address: string) => void;
  copiedAddress: string | null;
  formatAddress: (address: string) => string;
  formatDate: (timestamp: number) => string;
}

function StealthAddressItem({
  stealth,
  index,
  onCopy,
  onRemove,
  copiedAddress,
  formatAddress,
  formatDate,
}: StealthAddressItemProps) {
  return (
    <ListItem
      sx={{
        bgcolor: 'action.hover',
        borderRadius: 1,
        mb: 0.5,
        '&:hover': {
          bgcolor: 'action.selected',
        },
      }}
    >
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`#${index + 1}`}
              size="small"
              variant="outlined"
              sx={{ minWidth: 40 }}
            />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {formatAddress(stealth.address)}
            </Typography>
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              View Tag: {formatAddress(stealth.viewTag)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(stealth.createdAt)}
            </Typography>
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <Tooltip title={copiedAddress === stealth.address ? 'Kopyalandı!' : 'Adresi Kopyala'}>
          <IconButton
            edge="end"
            size="small"
            onClick={() => onCopy(stealth.address)}
            sx={{ mr: 0.5 }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Sil">
          <IconButton
            edge="end"
            size="small"
            onClick={() => onRemove(stealth.address)}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

export default StealthAddressPanel;
