import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// @mui
import { Stack, Button, Tooltip, Avatar } from '@mui/material';
// routes
import { fCurrency } from 'src/utils/formatNumber';
import { Web3ModalWalletButton } from 'src/auth/Web3ModalButtons';
import { useAccount } from '@starknet-react/core';
import Iconify from 'src/components/iconify';
import useResponsive from 'src/hooks/useResponsive';
import { PATH_DASHBOARD, PATH_AUTH } from '../../../routes/paths';
// auth
import { useAuthContext } from '../../../auth/useAuthContext';
// components
import { useSnackbar } from '../../../components/snackbar';

// Default avatar placeholder
const DEFAULT_AVATAR = '/assets/placeholder.svg';
// ----------------------------------------------------------------------

const OPTIONS = [
  {
    label: 'Home',
    linkTo: '/dashboard/app',
  },
  {
    label: 'Settings',
    linkTo: PATH_DASHBOARD.user.account,
  },
];

// ----------------------------------------------------------------------

export default function AccountPopover() {
  const navigate = useNavigate();
  const isDesktop = useResponsive('up', 'lg');

  const { user, logout } = useAuthContext();
  const { address, isConnected } = useAccount();

  const { enqueueSnackbar } = useSnackbar();

  const [openPopover, setOpenPopover] = useState<HTMLElement | null>(null);

  const handleOpenPopover = (event: React.MouseEvent<HTMLElement>) => {
    setOpenPopover(event.currentTarget);
  };

  const handleClosePopover = () => {
    setOpenPopover(null);
  };

  const handleLogout = async () => {
    try {
      logout();
      navigate(PATH_AUTH.login, { replace: true });
      handleClosePopover();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Unable to logout!', { variant: 'error' });
    }
  };

  const handleClickItem = (path: string) => {
    handleClosePopover();
    navigate(path);
  };
  
  const avatar = useMemo(() => DEFAULT_AVATAR, []);
  const balance = useMemo(() => fCurrency(Math.random() * 100), []);

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mx: 'auto',
          }}
        />
        {isConnected && address && (
          <Stack>
            <Tooltip title="Swap tokens on Starknet" arrow>
              <Button
                color='inherit'
                sx={{color: 'text.disabled'}}
                variant="outlined"
                startIcon={<Avatar sx={{width: 18, height: 18}} src='https://cdn.1inch.io/logo.png'/>}
                endIcon={<Iconify icon="eva:info-outline" color="gray" width={16} />}
              >
                {isDesktop ? 'Swap' : ''}
              </Button>
            </Tooltip>
          </Stack>
        )}
        <Web3ModalWalletButton />
      </Stack>
    </>
  );
}
