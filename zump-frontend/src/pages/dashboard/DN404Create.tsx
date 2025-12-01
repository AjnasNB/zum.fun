import { Helmet } from 'react-helmet-async';
// @mui
import { Container, Typography } from '@mui/material';
// routes
import {Notpump_DN404} from 'src/descriptions/DN404';
import { PATH_DASHBOARD } from '../../routes/paths';
// components
import { useSettingsContext } from '../../components/settings';
import CustomBreadcrumbs from '../../components/custom-breadcrumbs';
// sections
import { BlogNewPostForm } from '../../sections/@dashboard/blog';

// ----------------------------------------------------------------------

export default function DN404Create() {
  const { themeStretch } = useSettingsContext();

  return (
    <>
      <Helmet>
        <title> 👻 Create Private Memecoin | Zump.fun</title>
      </Helmet>

      <Container maxWidth={themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading="🚀 Launch Your Private Memecoin"
          links={[
            {
              name: Notpump_DN404,
            },
          ]}
        />

        <BlogNewPostForm />
      </Container>
    </>
  );
}
