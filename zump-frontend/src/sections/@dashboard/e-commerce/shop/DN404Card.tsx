import { paramCase } from 'change-case';
import { Link as RouterLink } from 'react-router-dom';
// @mui
import {
  Box,
  Card,
  Link,
  Stack,
  Fab,
  Typography,
  LinearProgress,
  Tooltip,
  Chip,
} from '@mui/material';
// routes
import TextMaxLine from 'src/components/text-max-line';
import { formatAddress } from 'src/utils/formatAddress';
import { useLocales } from 'src/locales';
import { Notpump_DEFINE_FAIRLAUNCH, WALLET } from 'src/descriptions/DN404';
import { PATH_DASHBOARD } from '../../../../routes/paths';
// utils
import { fCurrency, fShortenNumber } from '../../../../utils/formatNumber';
// redux
import { useDispatch } from '../../../../redux/store';
import { addToCart } from '../../../../redux/slices/DN404';
// @types
import { IDN404MetaData } from '../../../../@types/DN404';
// components
import Iconify from '../../../../components/iconify';
import Label from '../../../../components/label';
import Image from '../../../../components/image';
import { ColorPreview } from '../../../../components/color-utils';

// ----------------------------------------------------------------------

type Props = {
  product: IDN404MetaData;
};

export default function DN404Card({ product }: Props) {
  const {
    id,
    name,
    symbol,
    coverUrl,
    price,
    colors,
    status,
    available,
    sizes,
    wallet,
    bondingCurveProccess,
    marketCap,
    holdersCount,
    isMigrated,
    privacyLevel,
  } = product;

  const dispatch = useDispatch();

  const linkTo = PATH_DASHBOARD.dn404.view(paramCase(name));
  const { translate } = useLocales();

  // Use on-chain bonding curve progress or fallback
  const progress = bondingCurveProccess ?? 0;

  // Determine status label and color
  const getStatusConfig = () => {
    if (isMigrated) {
      return { label: 'Migrated', color: 'success' as const };
    }
    if (privacyLevel === 'ghost') {
      return { label: 'Ghost', color: 'secondary' as const };
    }
    if (privacyLevel === 'stealth') {
      return { label: 'Stealth', color: 'info' as const };
    }
    if (status === 'active') {
      return { label: 'Active', color: 'primary' as const };
    }
    return { label: status || 'Active', color: 'info' as const };
  };

  const statusConfig = getStatusConfig();

  const handleAddCart = async () => {
    const newProduct = {
      id,
      name,
      coverUrl,
      available,
      price,
      colors: colors?.[0] ? [colors[0]] : ['#00AB55'],
      size: sizes?.[0] || 'default',
      quantity: 1,
    };
    try {
      dispatch(addToCart(newProduct));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card
      sx={{
        '&:hover .add-cart-btn': {
          opacity: 1,
        },
      }}
    >
      <Box sx={{ position: 'relative', p: 1 }}>
        {statusConfig.label && (
          <Label
            variant="filled"
            color={statusConfig.color}
            sx={{
              top: 16,
              right: 16,
              zIndex: 9,
              position: 'absolute',
              textTransform: 'uppercase',
            }}
          >
            {statusConfig.label}
          </Label>
        )}

        <Fab
          color="warning"
          size="medium"
          className="add-cart-btn"
          onClick={handleAddCart}
          sx={{
            right: 16,
            bottom: 16,
            zIndex: 9,
            opacity: 0,
            position: 'absolute',
            transition: (theme) =>
              theme.transitions.create('all', {
                easing: theme.transitions.easing.easeInOut,
                duration: theme.transitions.duration.shorter,
              }),
          }}
        >
          <Iconify icon="ic:round-add-shopping-cart" />
        </Fab>

        <Image alt={name} src={coverUrl} ratio="1/1" sx={{ borderRadius: 1.5 }} />
      </Box>

      {/* Bonding Curve Progress */}
      <Stack spacing={1} sx={{ pl: 1, pr: 3, pt: 0 }} direction="row" alignItems="center">
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progress >= 100 ? 'success' : 'primary'}
          sx={{
            mx: 2,
            flexGrow: 1,
            mr: 0.5,
            height: 6,
            borderRadius: 1,
          }}
        />
        <Tooltip title={`Bonding Curve: ${progress.toFixed(1)}%`} arrow>
          <Box component="span">
            <Iconify icon="eva:info-outline" color="gray" width={16} />
          </Box>
        </Tooltip>
      </Stack>

      {/* Fair Launch Progress */}
      <Stack spacing={1} sx={{ pl: 1, pr: 3, pt: 0.5 }} direction="row" alignItems="center">
        <LinearProgress
          color="warning"
          variant="determinate"
          value={Math.min(progress * 1.2, 100)} // Slightly ahead for visual effect
          sx={{
            mx: 2,
            mr: 0.5,
            flexGrow: 1,
            height: 6,
            borderRadius: 1,
          }}
        />
        <Tooltip title={`${translate(Notpump_DEFINE_FAIRLAUNCH)}`} arrow>
          <Box component="span">
            <Iconify icon="eva:info-outline" color="gray" width={16} />
          </Box>
        </Tooltip>
      </Stack>

      <Stack spacing={1} sx={{ p: 3, pt: 2 }}>
        <Link component={RouterLink} to={linkTo} color="inherit" variant="subtitle2" noWrap>
          {symbol?.toUpperCase() || name.split(' ')[0].toUpperCase()} / ({name})
        </Link>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          {formatAddress(wallet || WALLET)}
        </Typography>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack spacing={0.5} sx={{ typography: 'subtitle1' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              MC: {fCurrency(marketCap || 0)}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              Sold: {fShortenNumber(product?.sold || 0)}
            </Typography>
          </Stack>

          <Stack spacing={0.5} sx={{ typography: 'subtitle1' }} alignItems="flex-end">
            <Box component="span" sx={{ fontWeight: 'bold' }}>
              {fCurrency(price)}
            </Box>
            {colors && colors.length > 0 && (
              <Box component="span">
                <ColorPreview colors={colors} />
              </Box>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}
