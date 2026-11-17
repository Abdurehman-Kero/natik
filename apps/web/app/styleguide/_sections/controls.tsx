'use client';

import { UPLOAD_LIMITS } from '@natik/shared';
import { Download, Landmark, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDrop } from '@/components/ui/file-drop';
import { FormActions } from '@/components/ui/form-field';
import {
  DateField,
  MoneyField,
  SearchField,
  TextareaField,
  TextField,
} from '@/components/ui/input';
import { OtpField } from '@/components/ui/otp-field';
import { PasswordField } from '@/components/ui/password-field';
import { PhoneField } from '@/components/ui/phone-field';
import { RadioCards } from '@/components/ui/radio-cards';
import { SelectField } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Demo, Section } from './section';

export function Controls() {
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [completed, setCompleted] = useState<string | null>(null);
  const [language, setLanguage] = useState('ar');

  return (
    <>
      <Section
        id="buttons"
        title="Buttons"
        note="One primary button per view. Every button is at least 44 px tall."
      >
        <Demo title="Variants" className="flex flex-wrap items-center gap-3">
          <Button>Enrol free</Button>
          <Button variant="secondary">Preview</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Cancel enrolment</Button>
          <Button variant="accent" size="lg">
            Download certificate
          </Button>
        </Demo>
        <Demo title="Sizes, states and icons" className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Submit payment
          </Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary">
            <Download aria-hidden /> Download PDF
          </Button>
          <LinkButton href="/courses" variant="ghost">
            Link button
          </LinkButton>
          <IconButton label="Add lesson" variant="secondary">
            <Plus />
          </IconButton>
          <IconButton label="Delete">
            <Trash2 />
          </IconButton>
        </Demo>
        <Demo title="On navy" className="on-dark flex flex-wrap gap-3 bg-primary">
          <Button variant="onDark">Browse courses</Button>
          <Button variant="outlineOnDark">Try a free lesson</Button>
        </Demo>
      </Section>

      <Section
        id="inputs"
        title="Inputs"
        note="Label above, hint and error below. Phones get the right keyboard for each field."
      >
        <Demo title="Text fields" className="grid gap-5 md:grid-cols-2">
          <TextField label="Full name" autoComplete="name" placeholder="Abdi Kedir" />
          <TextField label="Email" optional type="email" autoComplete="email" />
          <PhoneField label="Phone number" />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            hint="8+ characters, a letter and a number"
          />
          <TextField label="Full name" defaultValue="A" error="Enter your full name." />
          <PhoneField
            label="Phone number"
            defaultValue="0911"
            error="Enter a 9-digit Ethiopian mobile number."
          />
        </Demo>
        <Demo title="Specialised" className="grid gap-5 md:grid-cols-2">
          <MoneyField label="Amount paid" defaultValue="1500" />
          <DateField label="Date paid" />
          <SelectField
            label="Level"
            placeholder="Any level"
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
          <SearchField label="Search users" placeholder="Search name or phone…" />
          <TextareaField label="Message" placeholder="How can we help?" className="md:col-span-2" />
        </Demo>
        <Demo title="SMS code" className="flex flex-col gap-3">
          <OtpField
            label="Enter the 6-digit code"
            hint="Sent to +251 9•• ••• 678"
            value={otp}
            onValueChange={setOtp}
            onComplete={(code) => setCompleted(code)}
          />
          <p className="text-sm text-muted" aria-live="polite">
            {completed
              ? `Complete: ${completed} (would submit automatically)`
              : 'Type, paste or use SMS autofill.'}
          </p>
        </Demo>
        <Demo title="File upload" className="grid gap-5 md:grid-cols-2">
          <FileDrop
            label="Lesson PDF"
            accept="application/pdf,.pdf"
            typesLabel="PDF"
            maxBytes={UPLOAD_LIMITS.pdf.maxBytes}
          />
          <FileDrop
            label="Receipt photo"
            optional
            accept="image/*"
            typesLabel="JPG, PNG"
            maxBytes={UPLOAD_LIMITS.receipt.maxBytes}
            files={[new File(['x'.repeat(1200)], 'receipt-telebirr.jpg', { type: 'image/jpeg' })]}
            progress={64}
          />
        </Demo>
        <Demo title="Form actions">
          <FormActions>
            <Button variant="secondary">Cancel</Button>
            <Button>Save</Button>
          </FormActions>
        </Demo>
      </Section>

      <Section
        id="selection"
        title="Selection"
        note="Two to four choices show as chips or cards, not a dropdown."
      >
        <Demo title="Radio chips and cards" className="flex flex-col gap-6">
          <RadioCards
            label="I want to learn"
            value={language}
            onValueChange={setLanguage}
            options={[
              { value: 'ar', label: 'Arabic' },
              { value: 'en', label: 'English' },
              { value: 'om', label: 'Afaan Oromo' },
            ]}
          />
          <RadioCards
            label="Payment method"
            layout="cards"
            defaultValue="bank"
            options={[
              {
                value: 'bank',
                label: 'Bank transfer',
                description: 'CBE, Awash, Dashen…',
                icon: Landmark,
              },
              {
                value: 'wallet',
                label: 'Mobile wallet',
                description: 'telebirr, CBE Birr',
                icon: Smartphone,
              },
            ]}
          />
        </Demo>
        <Demo title="Checkbox and switch" className="flex max-w-lg flex-col gap-5">
          <Checkbox label="I'm 16 or older and accept the Terms and Privacy notice" />
          <Checkbox label="Keep me signed in" defaultChecked />
          <Checkbox label="I accept the terms" error="Please accept to continue." />
          <Switch
            label="Free preview"
            description="Visitors can open this lesson without signing in"
          />
          <Switch label="Allow downloads" defaultChecked />
        </Demo>
      </Section>
    </>
  );
}
